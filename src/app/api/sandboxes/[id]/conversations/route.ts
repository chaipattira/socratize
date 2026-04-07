import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sandbox = await prisma.sandbox.findUnique({ where: { id } })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const conversations = await prisma.sandboxConversation.findMany({
    where: { sandboxId: id },
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
  const sandbox = await prisma.sandbox.findUnique({ where: { id } })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const conv = await prisma.sandboxConversation.create({
    data: { sandboxId: id, title: 'New conversation', updatedAt: new Date() },
    select: { id: true, title: true, createdAt: true },
  })
  return NextResponse.json({ conversation: conv }, { status: 201 })
}
