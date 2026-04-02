import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const sessions = await prisma.chatSession.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      llmProvider: true,
      model: true,
      extractionMode: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  })
  return NextResponse.json(sessions)
}

export async function POST(request: Request) {
  const {
    title,
    llmProvider = 'anthropic',
    model = 'claude-sonnet-4-6',
    extractionMode = 'guided',
  } = await request.json()

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  if (extractionMode !== 'guided' && extractionMode !== 'direct') {
    return NextResponse.json({ error: 'extractionMode must be "guided" or "direct"' }, { status: 400 })
  }

  const session = await prisma.chatSession.create({
    data: { title: title.trim(), llmProvider, model, extractionMode },
  })
  return NextResponse.json(session, { status: 201 })
}
