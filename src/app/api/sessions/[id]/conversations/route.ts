import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await prisma.chatSession.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const conversations = await prisma.sessionConversation.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, createdAt: true },
  })
  return NextResponse.json({ conversations })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await prisma.chatSession.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const conv = await prisma.sessionConversation.create({
    data: { sessionId: id, title: 'New conversation', updatedAt: new Date() },
    select: { id: true, title: true, createdAt: true },
  })
  return NextResponse.json({ conversation: conv }, { status: 201 })
}
