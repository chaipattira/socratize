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
  initialMessages: Anthropic.MessageParam[],
  folderPath: string,
  send: (data: object) => void,
  thinkingEnabled: boolean,
): Promise<{ fullText: string; toolHistory: Anthropic.MessageParam[] }> {
  const loopMessages: Anthropic.MessageParam[] = [...initialMessages]
  const startLen = loopMessages.length

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

  return { fullText, toolHistory: loopMessages.slice(startLen) }
}

async function runOpenAIKbLoop(
  openai: OpenAI,
  model: string,
  systemPrompt: string,
  initialMessages: OpenAI.Chat.ChatCompletionMessageParam[],
  folderPath: string,
  send: (data: object) => void,
  thinkingEnabled: boolean,
): Promise<{ fullText: string; toolHistory: any[] }> {
  if (thinkingEnabled) {
    // Use Responses API to get reasoning summaries
    let inputItems: any[] = [
      { role: 'system', content: systemPrompt },
      ...initialMessages,
    ]
    const startLen = inputItems.length
    let fullText = ''

    while (true) {
      const response = await (openai.responses.create as any)({
        model,
        tools: KB_TOOLS_OPENAI,
        input: inputItems,
        reasoning: { effort: 'medium', summary: 'auto' },
      })

      const functionCalls: { id: string; name: string; arguments: string }[] = []

      for (const item of (response.output ?? []) as any[]) {
        if (item.type === 'reasoning') {
          const summaryText = ((item.summary ?? []) as any[])
            .map((s: any) => s.text ?? '')
            .join('')
          if (summaryText) send({ type: 'thinking', delta: summaryText })
        } else if (item.type === 'function_call') {
          functionCalls.push({ id: item.call_id ?? item.id, name: item.name, arguments: item.arguments ?? '{}' })
        } else if (item.type === 'message') {
          const textContent = ((item.content ?? []) as any[])
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text ?? '')
            .join('')
          if (textContent) fullText = textContent
        }
      }

      if (functionCalls.length > 0) {
        // Add assistant's output items to input for next iteration
        inputItems = [...inputItems, ...(response.output ?? [])]

        const toolResults: any[] = []
        for (const fc of functionCalls) {
          const input = JSON.parse(fc.arguments) as Record<string, unknown>
          send({ type: 'tool_call', name: fc.name, input })
          const result = executeKbTool(fc.name, input, folderPath)
          if (result.fileUpdate) {
            send({ type: 'file_update', filename: result.fileUpdate.filename, content: result.fileUpdate.content })
          }
          send({ type: 'tool_result', name: fc.name, success: !result.content.startsWith('Error') })
          toolResults.push({
            type: 'function_call_output',
            call_id: fc.id,
            output: result.content,
          })
        }
        inputItems = [...inputItems, ...toolResults]
      } else {
        send({ type: 'text', delta: fullText })
        break
      }
    }

    return { fullText, toolHistory: inputItems.slice(startLen) }
  }

  type OAIMessage = OpenAI.Chat.ChatCompletionMessageParam
  const loopMessages: OAIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...initialMessages,
  ]
  const startLen = loopMessages.length

  let fullText = ''

  while (true) {
    const response = await openai.chat.completions.create({
      model,
      tools: KB_TOOLS_OPENAI,
      messages: loopMessages,
      ...(thinkingEnabled ? { reasoning_effort: 'medium' } : {}),
    } as any)

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

  return { fullText, toolHistory: loopMessages.slice(startLen) }
}

// Build Anthropic message history for KB sessions, expanding stored tool call/result blocks.
// Each assistant message may have a toolHistory field containing the intermediate tool exchange
// that preceded it. We expand those before the assistant's text response so the model sees
// its full prior context and doesn't re-read files it already read.
function buildAnthropicKbMessages(
  history: Array<{ role: string; content: string; toolHistory?: string | null }>,
  newMessage: string,
): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = []
  for (const m of history) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    if (m.role === 'assistant' && m.toolHistory) {
      const toolMsgs: Anthropic.MessageParam[] = JSON.parse(m.toolHistory)
      result.push(...toolMsgs)
    }
    result.push({ role: m.role as 'user' | 'assistant', content: m.content })
  }
  result.push({ role: 'user', content: newMessage })
  return result
}

// Build OpenAI Chat message history for KB sessions, expanding stored tool call/result messages.
function buildOpenAIChatKbMessages(
  history: Array<{ role: string; content: string; toolHistory?: string | null }>,
  newMessage: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = []
  for (const m of history) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    if (m.role === 'assistant' && m.toolHistory) {
      const toolMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = JSON.parse(m.toolHistory)
      result.push(...toolMsgs)
    }
    result.push({ role: m.role as 'user' | 'assistant', content: m.content })
  }
  result.push({ role: 'user', content: newMessage })
  return result
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

          let kbToolHistory: any[] = []

          if (session.llmProvider === 'anthropic') {
            const anthropic = new Anthropic({ apiKey: decryptedKey })
            const anthropicMessages = buildAnthropicKbMessages(messages, triggerMessage)
            const result = await runAnthropicKbLoop(
              anthropic, session.model, systemPrompt, anthropicMessages, session.knowledgeFolderPath, send, thinkingEnabled
            )
            fullAssistantText = result.fullText
            kbToolHistory = result.toolHistory
          } else {
            const openai = new OpenAI({ apiKey: decryptedKey })
            const openaiMessages = buildOpenAIChatKbMessages(messages, triggerMessage)
            const result = await runOpenAIKbLoop(
              openai, session.model, systemPrompt, openaiMessages, session.knowledgeFolderPath, send, thinkingEnabled
            )
            fullAssistantText = result.fullText
            kbToolHistory = result.toolHistory
          }

          // Save messages (skip user message if this is the KB start trigger)
          const messageSaves: Promise<unknown>[] = [
            prisma.message.create({
              data: {
                chatSessionId: sessionId,
                role: 'assistant',
                content: fullAssistantText,
                toolHistory: kbToolHistory.length ? JSON.stringify(kbToolHistory) : null,
              },
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

            if (thinkingEnabled) {
              // Use Responses API to get reasoning summaries
              const stream = openai.responses.stream({
                model: session.model,
                input: [
                  { role: 'system', content: systemPrompt },
                  ...conversationMessages,
                ],
                tools: [UPDATE_DOCUMENT_TOOL_OPENAI as any],
                reasoning: { effort: 'medium', summary: 'auto' },
              } as any)

              for await (const event of (stream as any)) {
                if (event.type === 'response.output_item.done' && event.item?.type === 'reasoning') {
                  const summaryText = (event.item.summary ?? [])
                    .map((s: { text?: string }) => s.text ?? '')
                    .join('')
                  if (summaryText) send({ type: 'thinking', delta: summaryText })
                } else if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
                  send({ type: 'tool_call', name: event.item.name, input: {} })
                } else if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
                  try {
                    const parsed = JSON.parse(event.item.arguments ?? '{}')
                    extractedOps = parsed.ops ?? []
                    send({ type: 'doc_ops', ops: extractedOps })
                  } catch {}
                  send({ type: 'tool_result', name: event.item.name, success: true })
                } else if (event.type === 'response.output_text.delta') {
                  fullAssistantText += event.delta ?? ''
                  send({ type: 'text', delta: event.delta ?? '' })
                }
              }
            } else {
              // Existing Chat Completions streaming path
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
