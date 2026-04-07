import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

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

  const sandbox = await prisma.sandbox.findUnique({ where: { id } })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!sandbox.skillFolderPath) {
    return NextResponse.json({ error: 'No skill folder configured for this sandbox' }, { status: 400 })
  }

  const feedbackFilePath = path.join(sandbox.skillFolderPath, 'feedback.md')
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
  const emoji = rating === 'up' ? '👍' : '👎'

  const skillsList = Array.isArray(activeSkills) && activeSkills.length > 0
    ? (activeSkills as string[]).join(', ')
    : 'none'

  const lines: string[] = [`### [OPEN] ${timestamp} — ${emoji}`]
  lines.push(`**Skills active:** ${skillsList}`)
  if (promptExcerpt && typeof promptExcerpt === 'string') {
    lines.push(`**Prompt excerpt:** "${promptExcerpt.slice(0, 200)}"`)
  }
  if (responseExcerpt && typeof responseExcerpt === 'string') {
    lines.push(`**Response excerpt:** "${responseExcerpt.slice(0, 200)}"`)
  }
  if (comment && typeof comment === 'string' && comment.trim()) {
    lines.push(`**Comment:** ${comment.trim()}`)
  }
  lines.push('', '---', '')

  const entry = lines.join('\n') + '\n'

  if (!fs.existsSync(feedbackFilePath)) {
    fs.writeFileSync(feedbackFilePath, '# Feedback\n\n', 'utf-8')
  }
  fs.appendFileSync(feedbackFilePath, entry, 'utf-8')

  return NextResponse.json({ ok: true, skillFolderPath: sandbox.skillFolderPath })
}
