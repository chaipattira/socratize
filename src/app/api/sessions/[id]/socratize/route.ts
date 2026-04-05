import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import {
  buildSocratizeSystemPrompt,
  buildSocratizeMessages,
  SOCRATIZE_TOOLS_ANTHROPIC,
  SOCRATIZE_TOOLS_OPENAI,
  type SocratizeMessage,
} from '@/lib/socratize-prompt'
import { validateSkillFilename, writeKbFile, readKbFile, listFiles } from '@/lib/knowledge-base'

function executeSocratizeTool(
  name: string,
  input: Record<string, unknown>,
  folderPath: string
): { result: string; fileUpdate?: { filename: string; content: string } } {
  if (name === 'list_files') {
    const all = listFiles(folderPath)
    const skillFiles = all.filter(f => f.endsWith('-SKILL.md') || f === 'SKILL.md')
    return { result: skillFiles.length > 0 ? skillFiles.join('\n') : '(no skill files yet)' }
  }
  if (name === 'read_file') {
    const filename = input.filename as string
    if (!validateSkillFilename(filename)) return { result: 'Error: invalid skill filename' }
    try {
      return { result: readKbFile(folderPath, filename) }
    } catch {
      return { result: `Error: file "${filename}" not found` }
    }
  }
  if (name === 'write_skill_file') {
    const filename = input.filename as string
    const content = input.content as string
    if (!validateSkillFilename(filename)) return { result: 'Error: invalid skill filename' }
    try {
      writeKbFile(folderPath, filename, content)
      return { result: 'ok', fileUpdate: { filename, content } }
    } catch (e) {
      return { result: `Error: ${String(e)}` }
    }
  }
  return { result: 'Error: unknown tool' }
}

async function runAnthropicSocratizeLoop(
  anthropic: Anthropic,
  model: string,
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  folderPath: string,
  send: (data: object) => void
): Promise<string> {
  const loopMessages: Anthropic.MessageParam[] = [...messages]
  let fullText = ''

  while (true) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: SOCRATIZE_TOOLS_ANTHROPIC as any,
      messages: loopMessages,
    })

    let turnText = ''
    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

    for (const block of response.content) {
      if (block.type === 'text') {
        turnText += block.text
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> })
      }
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        send({ type: 'tool_call', name: toolUse.name, input: toolUse.input })
        const { result, fileUpdate } = executeSocratizeTool(toolUse.name, toolUse.input, folderPath)
        if (fileUpdate) {
          send({ type: 'file_update', filename: fileUpdate.filename, content: fileUpdate.content })
        }
        send({ type: 'tool_result', name: toolUse.name, success: !result.startsWith('Error') })
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
      }

      loopMessages.push({ role: 'assistant', content: response.content })
      loopMessages.push({ role: 'user', content: toolResults })
    } else {
      fullText = turnText
      send({ type: 'text', delta: fullText })
      break
    }
  }

  return fullText
}

async function runOpenAISocratizeLoop(
  openai: OpenAI,
  model: string,
  systemPrompt: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  folderPath: string,
  send: (data: object) => void
): Promise<string> {
  type OAIMessage = OpenAI.Chat.ChatCompletionMessageParam
  const loopMessages: OAIMessage[] = [{ role: 'system', content: systemPrompt }, ...messages]
  let fullText = ''

  while (true) {
    const response = await openai.chat.completions.create({
      model,
      tools: SOCRATIZE_TOOLS_OPENAI,
      messages: loopMessages,
    })

    const choice = response.choices[0]
    const message = choice.message

    if (choice.finish_reason === 'tool_calls' && message.tool_calls) {
      const toolResults: OAIMessage[] = []

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') continue
        const name = toolCall.function.name
        const input = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
        send({ type: 'tool_call', name, input })
        const { result, fileUpdate } = executeSocratizeTool(name, input, folderPath)
        if (fileUpdate) {
          send({ type: 'file_update', filename: fileUpdate.filename, content: fileUpdate.content })
        }
        send({ type: 'tool_result', name, success: !result.startsWith('Error') })
        toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: result })
      }

      loopMessages.push(message)
      loopMessages.push(...toolResults)
    } else {
      fullText = message.content ?? ''
      send({ type: 'text', delta: fullText })
      break
    }
  }

  return fullText
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params
  const { followUps = [] } = await request.json()

  const [session, allKeys] = await Promise.all([
    prisma.chatSession.findUnique({ where: { id: sessionId } }),
    prisma.apiKey.findMany(),
  ])

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const apiKeyRecord = allKeys.find(k => k.provider === session.llmProvider) ?? allKeys[0]
  if (!apiKeyRecord) {
    return NextResponse.json(
      { error: 'No API key found. Add one in Settings.' },
      { status: 400 }
    )
  }

  if (!session.knowledgeFolderPath) {
    return NextResponse.json(
      { error: 'Session has no knowledge folder path.' },
      { status: 400 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        const decryptedKey = decrypt(apiKeyRecord.encryptedKey)
        const systemPrompt = buildSocratizeSystemPrompt()
        const messages = buildSocratizeMessages(session.title, followUps as SocratizeMessage[])

        if (apiKeyRecord.provider === 'anthropic') {
          const anthropic = new Anthropic({ apiKey: decryptedKey })
          await runAnthropicSocratizeLoop(
            anthropic, session.model, systemPrompt,
            messages as Anthropic.MessageParam[],
            session.knowledgeFolderPath!, send
          )
        } else {
          const openai = new OpenAI({ apiKey: decryptedKey })
          await runOpenAISocratizeLoop(
            openai, session.model, systemPrompt,
            messages as OpenAI.Chat.ChatCompletionMessageParam[],
            session.knowledgeFolderPath!, send
          )
        }

        send({ type: 'done' })
      } catch (err) {
        console.error('[socratize] Error:', err)
        const is401 = err instanceof Error && (err as any).status === 401
        send({
          type: 'error',
          message: is401
            ? 'Invalid API key. Check your key in Settings.'
            : 'An error occurred. Please try again.',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
