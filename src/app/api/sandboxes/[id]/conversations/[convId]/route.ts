import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; convId: string }> }
) {
  const { id, convId } = await params
  const body = await request.json() as { title?: string }
  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }
  const trimmedTitle = body.title.trim()
  if (!trimmedTitle) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  const sandbox = await prisma.sandbox.findUnique({ where: { id } })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const conv = await prisma.sandboxConversation.findFirst({
    where: { id: convId, sandboxId: id },
  })
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.sandboxConversation.update({
    where: { id: convId },
    data: { title: trimmedTitle, updatedAt: new Date() },
    select: { id: true, title: true, createdAt: true },
  })
  return NextResponse.json({ conversation: updated })
}
