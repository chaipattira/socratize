import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import {
  buildSocratizeSystemPrompt,
  buildSocratizeMessages,
  WRITE_SKILL_FILE_TOOL,
  WRITE_SKILL_FILE_TOOL_OPENAI,
  type SocratizeMessage,
} from '@/lib/socratize-prompt'
import { validateSkillFilename, writeKbFile } from '@/lib/knowledge-base'

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

  const systemPrompt = buildSocratizeSystemPrompt()
  const messages = buildSocratizeMessages(session.title, followUps as SocratizeMessage[])

  const encoder = new TextEncoder()

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
            max_tokens: 4096,
            system: systemPrompt,
            tools: [WRITE_SKILL_FILE_TOOL as any],
            messages,
          })

          let toolInputBuffer = ''
          let inToolUse = false

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
              inToolUse = true
              toolInputBuffer = ''
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                send({ type: 'text', delta: event.delta.text })
              } else if (event.delta.type === 'input_json_delta') {
                toolInputBuffer += event.delta.partial_json
              }
            } else if (event.type === 'content_block_stop' && inToolUse) {
              try {
                const parsed = JSON.parse(toolInputBuffer)
                const { filename, content } = parsed
                if (filename && content && validateSkillFilename(filename)) {
                  writeKbFile(session.knowledgeFolderPath!, filename, content)
                  send({ type: 'file_update', filename, content })
                }
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
            tools: [WRITE_SKILL_FILE_TOOL_OPENAI],
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
          })

          let toolCallBuffer = ''
          for await (const chunk of openaiStream) {
            const delta = chunk.choices[0]?.delta
            if (delta?.content) {
              send({ type: 'text', delta: delta.content })
            }
            if (delta?.tool_calls?.[0]?.function?.arguments) {
              toolCallBuffer += delta.tool_calls[0].function.arguments
            }
            if (chunk.choices[0]?.finish_reason === 'tool_calls' && toolCallBuffer) {
              try {
                const parsed = JSON.parse(toolCallBuffer)
                const { filename, content } = parsed
                if (filename && content && validateSkillFilename(filename)) {
                  writeKbFile(session.knowledgeFolderPath!, filename, content)
                  send({ type: 'file_update', filename, content })
                }
              } catch {}
            }
          }
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
