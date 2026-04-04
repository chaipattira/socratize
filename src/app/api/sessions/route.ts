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
    sourceSessionId,
  } = await request.json()

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const validModes = ['guided', 'direct', 'socratize', 'socratize_eval']
  if (!validModes.includes(extractionMode)) {
    return NextResponse.json(
      { error: `extractionMode must be one of: ${validModes.join(', ')}` },
      { status: 400 }
    )
  }

  // For eval sessions, inherit folder path from source session
  let effectiveFolderPath = knowledgeFolderPath?.trim() ?? ''
  if (extractionMode === 'socratize_eval' && sourceSessionId) {
    const sourceSession = await prisma.chatSession.findUnique({
      where: { id: sourceSessionId },
      select: { knowledgeFolderPath: true },
    })
    effectiveFolderPath = sourceSession?.knowledgeFolderPath ?? ''
  }

  // Folder is required for guided, direct, and socratize
  const requiresFolder = ['guided', 'direct', 'socratize'].includes(extractionMode)
  if (requiresFolder) {
    if (!effectiveFolderPath) {
      return NextResponse.json({ error: 'knowledgeFolderPath is required' }, { status: 400 })
    }
    if (!fs.existsSync(effectiveFolderPath) || !fs.statSync(effectiveFolderPath).isDirectory()) {
      return NextResponse.json(
        { error: 'knowledgeFolderPath must be an existing directory' },
        { status: 400 }
      )
    }
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
