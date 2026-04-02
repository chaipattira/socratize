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

export async function POST(request: Request) {
  const { sessionId, message } = await request.json()
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

  const currentMarkdown = readDoc(sessionId)
  const systemPrompt = buildSystemPrompt(
    currentMarkdown,
    (session.extractionMode as ExtractionMode) ?? 'guided'
  )
  const conversationMessages = buildMessages(messages, message.trim())

  const encoder = new TextEncoder()
  let fullAssistantText = ''
  let extractedOps: DocOp[] = []

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        const decryptedKey = decrypt(apiKeyRecord.encryptedKey)
        if (apiKeyRecord.provider === 'anthropic') {
          const anthropic = new Anthropic({ apiKey: decryptedKey })
          const anthropicStream = anthropic.messages.stream({
            model: session.model,
            max_tokens: 2048,
            system: systemPrompt,
            tools: [UPDATE_DOCUMENT_TOOL as any],
            messages: conversationMessages,
          })

          let toolInputBuffer = ''
          let inToolUse = false

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
              inToolUse = true
              toolInputBuffer = ''
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                fullAssistantText += event.delta.text
                send({ type: 'text', delta: event.delta.text })
              } else if (event.delta.type === 'input_json_delta') {
                toolInputBuffer += event.delta.partial_json
              }
            } else if (event.type === 'content_block_stop' && inToolUse) {
              try {
                const parsed = JSON.parse(toolInputBuffer)
                extractedOps = parsed.ops ?? []
                send({ type: 'doc_ops', ops: extractedOps })
              } catch {}
              inToolUse = false
              toolInputBuffer = ''
            }
          }
        } else {
          // OpenAI
          const openai = new OpenAI({ apiKey: decryptedKey })
          const openaiStream = await openai.chat.completions.create({
            model: session.model,
            stream: true,
            tools: [UPDATE_DOCUMENT_TOOL_OPENAI],
            messages: [
              { role: 'system', content: systemPrompt },
              ...conversationMessages,
            ],
          })

          let toolCallBuffer = ''
          for await (const chunk of openaiStream) {
            const delta = chunk.choices[0]?.delta
            if (delta?.content) {
              fullAssistantText += delta.content
              send({ type: 'text', delta: delta.content })
            }
            if (delta?.tool_calls?.[0]?.function?.arguments) {
              toolCallBuffer += delta.tool_calls[0].function.arguments
            }
            if (chunk.choices[0]?.finish_reason === 'tool_calls' && toolCallBuffer) {
              try {
                const parsed = JSON.parse(toolCallBuffer)
                extractedOps = parsed.ops ?? []
                send({ type: 'doc_ops', ops: extractedOps })
              } catch {}
            }
          }
        }

        // Apply doc ops and save to disk + DB
        const newMarkdown = applyDocOps(currentMarkdown, extractedOps)
        writeDoc(sessionId, newMarkdown)

        await Promise.all([
          prisma.message.create({
            data: { chatSessionId: sessionId, role: 'user', content: message.trim() },
          }),
          prisma.message.create({
            data: {
              chatSessionId: sessionId,
              role: 'assistant',
              content: fullAssistantText,
              docOps: extractedOps.length ? JSON.stringify(extractedOps) : null,
            },
          }),
          prisma.chatSession.update({
            where: { id: sessionId },
            data: { updatedAt: new Date() },
          }),
        ])

        send({ type: 'done' })
      } catch (err) {
        console.error('[chat] Error:', err)
        // Never expose raw error strings — SDK auth errors may contain the API key
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
