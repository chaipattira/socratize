import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { buildSandboxSystemPrompt, SANDBOX_TOOLS_ANTHROPIC, SANDBOX_TOOLS_OPENAI } from '@/lib/sandbox-prompt'
import { buildLlmHistory } from '@/lib/sandbox-history'
import {
  listSkillsAcrossFolders,
  readSkillFile,
  readSkillFilePreview,
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
} from '@/lib/sandbox-tools'
import { runCommand } from '@/lib/pty-manager'

async function executeSandboxTool(
  name: string,
  input: Record<string, unknown>,
  skillFolderPaths: string[],
  workspacePath: string,
  enabledSkills: string[] | null,
  sandboxId: string
): Promise<{ result: string; fileUpdate?: { filename: string; content: string } }> {
  if (name === 'list_skills') {
    const skills = listSkillsAcrossFolders(skillFolderPaths)
    const filtered = enabledSkills ? skills.filter(s => enabledSkills.includes(s)) : skills
    return { result: filtered.length > 0 ? filtered.join('\n') : '(no skill files configured)' }
  }
  if (name === 'read_skill_preview' || name === 'read_skill') {
    const filename = input.filename as string
    if (enabledSkills && !enabledSkills.includes(filename)) {
      return { result: `Skill "${filename}" is currently disabled.` }
    }
  }
  if (name === 'read_skill_preview') {
    const filename = input.filename as string
    return { result: readSkillFilePreview(skillFolderPaths, filename) }
  }
  if (name === 'read_skill') {
    const filename = input.filename as string
    return { result: readSkillFile(skillFolderPaths, filename) }
  }
  if (name === 'list_files') {
    const files = listWorkspaceFiles(workspacePath)
    return { result: files.length > 0 ? files.join('\n') : '(workspace is empty)' }
  }
  if (name === 'read_file') {
    const filename = input.filename as string
    try {
      return { result: readWorkspaceFile(workspacePath, filename) }
    } catch (e) {
      return { result: `Error: ${String(e)}` }
    }
  }
  if (name === 'write_file') {
    const filename = input.filename as string
    const content = input.content as string
    try {
      writeWorkspaceFile(workspacePath, filename, content)
      return { result: 'ok', fileUpdate: { filename, content } }
    } catch (e) {
      return { result: `Error: ${String(e)}` }
    }
  }
  if (name === 'run_command') {
    const command = input.command as string
    const timeoutMs = typeof input.timeout_seconds === 'number'
      ? input.timeout_seconds * 1000
      : 30000
    try {
      const output = await runCommand(sandboxId, workspacePath, command, timeoutMs)
      return { result: output || '(no output)' }
    } catch (e) {
      return { result: `Error: ${String(e)}` }
    }
  }
  return { result: 'Error: unknown tool' }
}

async function runAnthropicLoop(
  anthropic: Anthropic,
  model: string,
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  skillFolderPaths: string[],
  workspacePath: string,
  enabledSkills: string[] | null,
  thinkingEnabled: boolean,
  sandboxId: string,
  send: (data: object) => void
): Promise<{ text: string; toolDelta: Anthropic.MessageParam[] }> {
  const loopMessages: Anthropic.MessageParam[] = [...messages]
  let fullText = ''
  const initialLength = loopMessages.length
  let iterations = 0

  while (true) {
    if (++iterations > 20) throw new Error('Agent loop exceeded maximum iterations')

    const createParams: Parameters<typeof anthropic.messages.create>[0] = {
      model,
      max_tokens: thinkingEnabled ? 16000 : 4096,
      system: systemPrompt,
      tools: SANDBOX_TOOLS_ANTHROPIC as any,
      messages: loopMessages,
    }
    if (thinkingEnabled) {
      (createParams as any).thinking = { type: 'enabled', budget_tokens: 10000 }
      ;(createParams as any).betas = ['interleaved-thinking-2025-05-14']
    }

    const response = await anthropic.messages.create(createParams) as Anthropic.Message

    let turnText = ''
    let turnThinking = ''
    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

    for (const block of response.content) {
      if (block.type === 'thinking') {
        turnThinking += (block as any).thinking ?? ''
      } else if (block.type === 'text') {
        turnText += block.text
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> })
      }
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        send({ type: 'tool_call', name: toolUse.name, input: toolUse.input })
        const { result, fileUpdate } = await executeSandboxTool(
          toolUse.name, toolUse.input, skillFolderPaths, workspacePath, enabledSkills, sandboxId
        )
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
      if (turnThinking) send({ type: 'thinking', delta: turnThinking })
      send({ type: 'text', delta: fullText })
      break
    }
  }

  return { text: fullText, toolDelta: loopMessages.slice(initialLength) }
}

async function runOpenAILoop(
  openai: OpenAI,
  model: string,
  systemPrompt: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  skillFolderPaths: string[],
  workspacePath: string,
  enabledSkills: string[] | null,
  sandboxId: string,
  send: (data: object) => void
): Promise<{ text: string; toolDelta: OpenAI.Chat.ChatCompletionMessageParam[] }> {
  type OAIMsg = OpenAI.Chat.ChatCompletionMessageParam
  const loopMessages: OAIMsg[] = [{ role: 'system', content: systemPrompt }, ...messages]
  let fullText = ''
  const initialLength = loopMessages.length
  let iterations = 0

  while (true) {
    if (++iterations > 20) throw new Error('Agent loop exceeded maximum iterations')
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 4096,
      tools: SANDBOX_TOOLS_OPENAI,
      messages: loopMessages,
    })

    const choice = response.choices[0]
    const message = choice.message

    if (choice.finish_reason === 'tool_calls' && message.tool_calls) {
      const toolResults: OAIMsg[] = []

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') continue
        const name = toolCall.function.name
        const input = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
        send({ type: 'tool_call', name, input })
        const { result, fileUpdate } = await executeSandboxTool(name, input, skillFolderPaths, workspacePath, enabledSkills, sandboxId)
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

  return { text: fullText, toolDelta: loopMessages.slice(initialLength) }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; convId: string }> }
) {
  const { id, convId } = await params
  const { message, thinkingEnabled = false, enabledSkills = null } = await request.json()

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const [conversation, allKeys] = await Promise.all([
    prisma.sandboxConversation.findUnique({
      where: { id: convId },
      include: {
        sandbox: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.apiKey.findMany(),
  ])

  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  const sandbox = conversation.sandbox

  const anthropicKey = allKeys.find(k => k.provider === 'anthropic')
  const openaiKey = allKeys.find(k => k.provider === 'openai')
  const apiKeyRecord = anthropicKey ?? openaiKey
  if (!apiKeyRecord) {
    return NextResponse.json({ error: 'No API key found. Add one in Settings.' }, { status: 400 })
  }

  const skillFolderPaths: string[] = JSON.parse(sandbox.skillFolderPaths || '[]')
  const systemPrompt = buildSandboxSystemPrompt()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        const decryptedKey = decrypt(apiKeyRecord.encryptedKey)
        const currentMessage = message as string

        // Build LLM messages from history + current
        const llmMessages = [
          ...buildLlmHistory(conversation.messages),
          { role: 'user' as const, content: currentMessage },
        ]

        const model = apiKeyRecord!.provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o'
        let assistantText = ''
        let toolDelta: Anthropic.MessageParam[] | OpenAI.Chat.ChatCompletionMessageParam[] = []

        if (apiKeyRecord!.provider === 'anthropic') {
          const anthropic = new Anthropic({ apiKey: decryptedKey })
          const result = await runAnthropicLoop(
            anthropic, model, systemPrompt,
            llmMessages as Anthropic.MessageParam[],
            skillFolderPaths, sandbox.workspaceFolderPath,
            enabledSkills as string[] | null,
            thinkingEnabled as boolean,
            id,
            send
          )
          assistantText = result.text
          toolDelta = result.toolDelta
        } else {
          const openai = new OpenAI({ apiKey: decryptedKey })
          const result = await runOpenAILoop(
            openai, model, systemPrompt,
            llmMessages as OpenAI.Chat.ChatCompletionMessageParam[],
            skillFolderPaths, sandbox.workspaceFolderPath,
            enabledSkills as string[] | null,
            id,
            send
          )
          assistantText = result.text
          toolDelta = result.toolDelta
        }

        // Persist user message + assistant response scoped to conversation
        const isFirstMessage = conversation.messages.length === 0
        await prisma.sandboxMessage.createMany({
          data: [
            { conversationId: convId, role: 'user', content: currentMessage },
            {
              conversationId: convId,
              role: 'assistant',
              content: assistantText,
              toolHistory: toolDelta.length > 0 ? JSON.stringify(toolDelta) : null,
            },
          ],
        })
        // Auto-title the conversation on first message
        if (isFirstMessage) {
          await prisma.sandboxConversation.update({
            where: { id: convId },
            data: { title: currentMessage.slice(0, 40).trim(), updatedAt: new Date() },
          })
        } else {
          await prisma.sandboxConversation.update({ where: { id: convId }, data: { updatedAt: new Date() } })
        }
        await prisma.sandbox.update({ where: { id }, data: { updatedAt: new Date() } })

        send({ type: 'done' })
      } catch (err) {
        console.error('[sandbox/conversations/chat] Error:', err)
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
