import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  let user: { id: string }
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessions = await prisma.chatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      llmProvider: true,
      model: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  })
  return NextResponse.json(sessions)
}

export async function POST(request: Request) {
  let user: { id: string }
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, llmProvider = 'anthropic', model = 'claude-sonnet-4-5-20250514' } =
    await request.json()

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const session = await prisma.chatSession.create({
    data: { userId: user.id, title: title.trim(), llmProvider, model },
  })
  return NextResponse.json(session, { status: 201 })
}
