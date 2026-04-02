import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readKbFile, writeKbFile, validateFilename } from '@/lib/knowledge-base'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const filename = searchParams.get('filename')

  if (!filename || !validateFilename(filename)) {
    return NextResponse.json({ error: 'Valid filename required' }, { status: 400 })
  }

  const session = await prisma.chatSession.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!session.knowledgeFolderPath) {
    return NextResponse.json({ error: 'Session has no knowledge base folder' }, { status: 400 })
  }

  try {
    const content = readKbFile(session.knowledgeFolderPath, filename)
    return NextResponse.json({ filename, content })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { filename, content } = await request.json()

  if (!filename || !validateFilename(filename)) {
    return NextResponse.json({ error: 'Valid filename required' }, { status: 400 })
  }
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
  }

  const session = await prisma.chatSession.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!session.knowledgeFolderPath) {
    return NextResponse.json({ error: 'Session has no knowledge base folder' }, { status: 400 })
  }

  writeKbFile(session.knowledgeFolderPath, filename, content)
  return new NextResponse(null, { status: 204 })
}
