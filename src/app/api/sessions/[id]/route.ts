import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const session = await prisma.chatSession.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    })
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(session)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const session = await prisma.chatSession.findFirst({
      where: { id: params.id, userId: user.id },
    })
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.chatSession.delete({ where: { id: params.id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
