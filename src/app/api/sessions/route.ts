import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'

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
    knowledgeFolderPath = '',
  } = await request.json()

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const validModes = ['guided', 'direct', 'socratize']
  if (!validModes.includes(extractionMode)) {
    return NextResponse.json(
      { error: `extractionMode must be one of: ${validModes.join(', ')}` },
      { status: 400 }
    )
  }

  const effectiveFolderPath = knowledgeFolderPath?.trim() ?? ''

  if (!effectiveFolderPath) {
      return NextResponse.json({ error: 'knowledgeFolderPath is required' }, { status: 400 })
  }
  if (!fs.existsSync(effectiveFolderPath) || !fs.statSync(effectiveFolderPath).isDirectory()) {
    return NextResponse.json(
      { error: 'knowledgeFolderPath must be an existing directory' },
      { status: 400 }
    )
  }

  const session = await prisma.chatSession.create({
    data: {
      title: title.trim(),
      llmProvider,
      model,
      extractionMode,
      knowledgeFolderPath: effectiveFolderPath,
    },
  })

  return NextResponse.json(session, { status: 201 })
}
