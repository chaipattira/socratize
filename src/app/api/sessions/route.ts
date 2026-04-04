import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readDoc, writeDoc } from '@/lib/local-docs'
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

  const folderPath = knowledgeFolderPath?.trim() ?? ''

  // Folder path is required for guided/direct (KB sessions), optional for skill modes
  if (extractionMode === 'guided' || extractionMode === 'direct') {
    if (!folderPath) {
      return NextResponse.json({ error: 'knowledgeFolderPath is required' }, { status: 400 })
    }
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return NextResponse.json(
        { error: 'knowledgeFolderPath must be an existing directory' },
        { status: 400 }
      )
    }
  }

  const session = await prisma.chatSession.create({
    data: { title: title.trim(), llmProvider, model, extractionMode, knowledgeFolderPath: folderPath },
  })

  // For eval sessions, copy the source session's skill doc to seed this session
  if (extractionMode === 'socratize_eval' && sourceSessionId) {
    const sourceDoc = readDoc(sourceSessionId)
    if (sourceDoc.trim()) {
      writeDoc(session.id, sourceDoc)
    }
  }

  return NextResponse.json(session, { status: 201 })
}
