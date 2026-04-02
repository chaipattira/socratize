import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteDoc } from '@/lib/local-docs'
import { listFiles } from '@/lib/knowledge-base'
import fs from 'fs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.chatSession.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true },
      },
    },
  })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const files =
    session.knowledgeFolderPath && fs.existsSync(session.knowledgeFolderPath)
      ? listFiles(session.knowledgeFolderPath)
      : []

  return NextResponse.json({ ...session, files })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.chatSession.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.chatSession.delete({ where: { id } })
  deleteDoc(id)
  return new NextResponse(null, { status: 204 })
}
