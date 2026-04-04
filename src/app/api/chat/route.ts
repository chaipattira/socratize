// src/app/api/chat/route.ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { readDoc, writeDoc } from '@/lib/local-docs'
import { applyDocOps, type DocOp } from '@/lib/doc-ops'
import {
  buildSystemPrompt,
  UPDATE_DOCUMENT_TOOL,
  UPDATE_DOCUMENT_TOOL_OPENAI,
  buildMessages,
  type ExtractionMode,
} from '@/lib/extraction-prompt'
import fs from 'fs'
import { listFiles, readKbFile, writeKbFile, applyKbFileOps, validateFilename } from '@/lib/knowledge-base'
import { KB_TOOLS_ANTHROPIC, KB_TOOLS_OPENAI } from '@/lib/kb-tools'
import { buildKbSystemPrompt } from '@/lib/kb-prompt'

interface KbToolResult {
  content: string
  fileUpdate?: { filename: string; content: string }
}

function executeKbTool(
  name: string,
  input: Record<string, unknown>,
  folderPath: string
): KbToolResult {
  if (name === 'list_files') {
    const files = listFiles(folderPath)
    return { content: files.length > 0 ? files.join('\n') : '(no files yet)' }
  }

  if (name === 'read_file') {
    const filename = input.filename as string
    if (!validateFilename(filename)) return { content: 'Error: invalid filename' }
    try {
      const content = readKbFile(folderPath, filename)
      return { content }
    } catch {
      return { content: `Error: file "${filename}" not found` }
    }
  }

  if (name === 'update_file') {
    const filename = input.filename as string
    const ops = input.ops as DocOp[]
    if (!validateFilename(filename)) return { content: 'Error: invalid filename' }
    try {
      applyKbFileOps(folderPath, filename, ops)
      const newContent = readKbFile(folderPath, filename)
      return { content: 'ok', fileUpdate: { filename, content: newContent } }
    } catch (e) {
      return { content: `Error: ${String(e)}` }
    }
  }

  if (name === 'create_file') {
    const filename = input.filename as string
    const content = input.content as string
    if (!validateFilename(filename)) return { content: 'Error: invalid filename' }
    try {
      writeKbFile(folderPath, filename, content)
      return { content: 'ok', fileUpdate: { filename, content } }
    } catch (e) {
      return { content: `Error: ${String(e)}` }
    }
  }

  return { content: 'Error: unknown tool' }
}

async function runAnthropicKbLoop(
  anthropic: Anthropic,
  model: string,
  systemPrompt: string,
  initialMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  folderPath: string,
  send: (data: object) => void,
  thinkingEnabled: boolean,
): Promise<string> {
  type AnthropicMessage = Anthropic.MessageParam
  const loopMessages: AnthropicMessage[] = initialMessages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  let fullText = ''

  while (true) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: thinkingEnabled ? 16000 : 4096,
      system: systemPrompt,
      tools: KB_TOOLS_ANTHROPIC as any,
      ...(thinkingEnabled ? { thinking: { type: 'enabled', budget_tokens: 10000 } } : {}),
      messages: loopMessages,
    } as any)

    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
    let turnText = ''

    for (const block of response.content) {
      if ((block as any).type === 'thinking') {
        send({ type: 'thinking', delta: (block as any).thinking })
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
        const result = executeKbTool(toolUse.name, toolUse.input, folderPath)
        if (result.fileUpdate) {
          send({ type: 'file_update', filename: result.fileUpdate.filename, content: result.fileUpdate.content })
        }
        send({ type: 'tool_result', name: toolUse.name, success: !result.content.startsWith('Error') })
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result.content })
      }

      loopMessages.push({ role: 'assistant', content: response.content })
      loopMessages.push({ role: 'user', content: toolResults })
    } else {
      // Final text response
      fullText = turnText
      send({ type: 'text', delta: fullText })
      break
    }
  }

  return fullText
}

async function runOpenAIKbLoop(
  openai: OpenAI,
  model: string,
  systemPrompt: string,
  initialMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  folderPath: string,
  send: (data: object) => void
): Promise<string> {
  type OAIMessage = OpenAI.Chat.ChatCompletionMessageParam
  const loopMessages: OAIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...initialMessages.map(m => ({ role: m.role, content: m.content } as OAIMessage)),
  ]

  let fullText = ''

  while (true) {
    const response = await openai.chat.completions.create({
      model,
      tools: KB_TOOLS_OPENAI,
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
        const result = executeKbTool(name, input, folderPath)
        if (result.fileUpdate) {
          send({ type: 'file_update', filename: result.fileUpdate.filename, content: result.fileUpdate.content })
        }
        send({ type: 'tool_result', name, success: !result.content.startsWith('Error') })
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result.content,
        })
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

export async function POST(request: Request) {
  const {
    sessionId,
    message,
    isKbTrigger = false,
    thinkingEnabled = false,
  } = await request.json()

  if (!sessionId || !message?.trim()) {
    return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 })
  }

  // Load session, history, and API keys
  const [session, messages, allKeys] = await Promise.all([
    prisma.chatSession.findUnique({ where: { id: sessionId } }),
    prisma.message.findMany({
      where: { chatSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.apiKey.findMany(),
  ])

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Prefer the key matching the session's provider
  const apiKeyRecord = allKeys.find(k => k.provider === session.llmProvider) ?? allKeys[0]

  if (!apiKeyRecord) {
    return NextResponse.json(
      { error: 'No API key found. Add one in Settings.' },
      { status: 400 }
    )
  }

  const isKbSession = !!session.knowledgeFolderPath

  const encoder = new TextEncoder()
  let fullAssistantText = ''

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        const decryptedKey = decrypt(apiKeyRecord.encryptedKey)

        if (isKbSession) {
          // KB agentic loop
          const systemPrompt = buildKbSystemPrompt(
            (session.extractionMode as ExtractionMode) ?? 'guided'
          )
          const triggerMessage = message.trim()
          const conversationMessages = buildMessages(messages, triggerMessage)

          if (session.llmProvider === 'anthropic') {
            const anthropic = new Anthropic({ apiKey: decryptedKey })
            fullAssistantText = await runAnthropicKbLoop(
              anthropic, session.model, systemPrompt, conversationMessages, session.knowledgeFolderPath, send, thinkingEnabled
            )
          } else {
            const openai = new OpenAI({ apiKey: decryptedKey })
            fullAssistantText = await runOpenAIKbLoop(
              openai, session.model, systemPrompt, conversationMessages, session.knowledgeFolderPath, send
            )
          }

          // Save messages (skip user message if this is the KB start trigger)
          const messageSaves: Promise<unknown>[] = [
            prisma.message.create({
              data: { chatSessionId: sessionId, role: 'assistant', content: fullAssistantText },
            }),
            prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } }),
          ]
          if (!isKbTrigger) {
            messageSaves.unshift(
              prisma.message.create({
                data: { chatSessionId: sessionId, role: 'user', content: message.trim() },
              })
            )
          }
          await Promise.all(messageSaves)
        } else {
          // Legacy single-doc flow
          const currentMarkdown = readDoc(sessionId)
          const systemPrompt = buildSystemPrompt(
            currentMarkdown,
            (session.extractionMode as ExtractionMode) ?? 'guided'
          )
          const conversationMessages = buildMessages(messages, message.trim())
          let extractedOps: DocOp[] = []

          if (session.llmProvider === 'anthropic') {
            const anthropic = new Anthropic({ apiKey: decryptedKey })
            const anthropicStream = anthropic.messages.stream({
              model: session.model,
              max_tokens: thinkingEnabled ? 16000 : 2048,
              system: systemPrompt,
              tools: [UPDATE_DOCUMENT_TOOL as any],
              ...(thinkingEnabled ? { thinking: { type: 'enabled', budget_tokens: 10000 } } : {}),
              messages: conversationMessages,
            } as any)

            let toolInputBuffer = ''
            let inToolUse = false
            let currentToolName = ''

            for await (const event of anthropicStream) {
              if (event.type === 'content_block_start' && (event.content_block.type === 'thinking' || event.content_block.type === 'tool_use')) {
                if (event.content_block.type === 'tool_use') {
                  inToolUse = true
                  toolInputBuffer = ''
                  currentToolName = event.content_block.name
                  send({ type: 'tool_call', name: currentToolName, input: {} })
                }
              } else if (event.type === 'content_block_delta') {
                if (event.delta.type === 'text_delta') {
                  fullAssistantText += event.delta.text
                  send({ type: 'text', delta: event.delta.text })
                } else if ((event.delta as any).type === 'thinking_delta') {
                  send({ type: 'thinking', delta: (event.delta as any).thinking })
                } else if (event.delta.type === 'input_json_delta') {
                  toolInputBuffer += event.delta.partial_json
                }
              } else if (event.type === 'content_block_stop' && inToolUse) {
                try {
                  const parsed = JSON.parse(toolInputBuffer)
                  extractedOps = parsed.ops ?? []
                  send({ type: 'doc_ops', ops: extractedOps })
                } catch {}
                send({ type: 'tool_result', name: currentToolName, success: true })
                inToolUse = false
                toolInputBuffer = ''
                currentToolName = ''
              }
            }
          } else {
            const openai = new OpenAI({ apiKey: decryptedKey })
            const openaiStream = await openai.chat.completions.create({
              model: session.model,
              stream: true,
              tools: [UPDATE_DOCUMENT_TOOL_OPENAI],
              messages: [{ role: 'system', content: systemPrompt }, ...conversationMessages],
            })

            let toolCallBuffer = ''
            let toolCallEmitted = false
            let toolCallName = 'update_document'

            for await (const chunk of openaiStream) {
              const delta = chunk.choices[0]?.delta
              if (delta?.content) {
                fullAssistantText += delta.content
                send({ type: 'text', delta: delta.content })
              }
              if (delta?.tool_calls?.[0]) {
                if (!toolCallEmitted) {
                  toolCallEmitted = true
                  toolCallName = delta.tool_calls[0].function?.name ?? 'update_document'
                  send({ type: 'tool_call', name: toolCallName, input: {} })
                }
                if (delta.tool_calls[0].function?.arguments) {
                  toolCallBuffer += delta.tool_calls[0].function.arguments
                }
              }
              if (chunk.choices[0]?.finish_reason === 'tool_calls' && toolCallBuffer) {
                try {
                  const parsed = JSON.parse(toolCallBuffer)
                  extractedOps = parsed.ops ?? []
                  send({ type: 'doc_ops', ops: extractedOps })
                } catch {}
                send({ type: 'tool_result', name: toolCallName, success: true })
              }
            }
          }

          const newMarkdown = applyDocOps(currentMarkdown, extractedOps)
          writeDoc(sessionId, newMarkdown)

          await Promise.all([
            prisma.message.create({ data: { chatSessionId: sessionId, role: 'user', content: message.trim() } }),
            prisma.message.create({
              data: {
                chatSessionId: sessionId,
                role: 'assistant',
                content: fullAssistantText,
                docOps: extractedOps.length ? JSON.stringify(extractedOps) : null,
              },
            }),
            prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } }),
          ])
        }

        send({ type: 'done' })
      } catch (err) {
        console.error('[chat] Error:', err)
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
