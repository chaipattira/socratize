import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

async function generateSummary(
  apiKey: string,
  rating: 'up' | 'down',
  skillsList: string,
  promptExcerpt: string,
  responseExcerpt: string,
  comment: string,
): Promise<string> {
  const anthropic = new Anthropic({ apiKey })
  const parts = [
    `Rating: ${rating === 'up' ? 'positive (👍)' : 'negative (👎)'}`,
    `Skills active: ${skillsList}`,
    promptExcerpt && `Prompt: ${promptExcerpt}`,
    responseExcerpt && `Response: ${responseExcerpt}`,
    comment && `User comment: ${comment}`,
  ].filter(Boolean).join('\n')

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Write one paragraph (no headings or subheadings) that puts the user's comment in context with the conversation below. The paragraph should reflect what the user said — do not interpret, judge, or summarize what worked or didn't; just explain the comment in light of the prompt and response.\n\n${parts}`,
    }],
  })

  const block = msg.content[0]
  return block.type === 'text' ? block.text.trim() : ''
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { rating, comment, activeSkills, promptExcerpt, responseExcerpt } = body

  if (rating !== 'up' && rating !== 'down') {
    return NextResponse.json({ error: 'rating must be "up" or "down"' }, { status: 400 })
  }

  const [sandbox, anthropicKey] = await Promise.all([
    prisma.sandbox.findUnique({ where: { id } }),
    prisma.apiKey.findFirst({ where: { provider: 'anthropic' } }),
  ])
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!anthropicKey) return NextResponse.json({ error: 'No Anthropic API key configured' }, { status: 400 })

  if (!sandbox.skillFolderPath) {
    return NextResponse.json({ error: 'No skill folder configured for this sandbox' }, { status: 400 })
  }

  const skillsList = Array.isArray(activeSkills) && activeSkills.length > 0
    ? (activeSkills as string[]).join(', ')
    : 'none'

  const rawPrompt = typeof promptExcerpt === 'string' ? promptExcerpt : ''
  // If the message starts with a quoted block ("> ..."), skip past it to the actual user message
  const strippedPrompt = rawPrompt.startsWith('>')
    ? (rawPrompt.split('\n\n').slice(1).join('\n\n').trim() || rawPrompt.trim())
    : rawPrompt.trim()
  const promptStr = strippedPrompt.slice(0, 500)
  const responseStr = typeof responseExcerpt === 'string' ? responseExcerpt.slice(0, 500) : ''
  const commentStr = typeof comment === 'string' ? comment.trim() : ''

  const decryptedKey = decrypt(anthropicKey.encryptedKey)
  const summary = await generateSummary(decryptedKey, rating as 'up' | 'down', skillsList, promptStr, responseStr, commentStr)

  const feedbackFilePath = path.join(sandbox.skillFolderPath, 'feedback.md')
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
  const emoji = rating === 'up' ? '👍' : '👎'

  const lines: string[] = [`### [OPEN] ${timestamp} — ${emoji} | ${skillsList}`]
  lines.push('')
  lines.push(`**For Socratize:** ${summary}`)
  lines.push('')
  if (promptStr) lines.push(`**Prompt:** ${promptStr}`)
  if (responseStr) lines.push(`**Response:** ${responseStr}`)
  if (commentStr) lines.push(`**Comment:** ${commentStr}`)
  lines.push('', '---', '')

  const entry = lines.join('\n') + '\n'

  if (!fs.existsSync(feedbackFilePath)) {
    fs.writeFileSync(feedbackFilePath, '# Feedback\n\n', 'utf-8')
  }
  fs.appendFileSync(feedbackFilePath, entry, 'utf-8')

  return NextResponse.json({ ok: true, skillFolderPath: sandbox.skillFolderPath })
}
