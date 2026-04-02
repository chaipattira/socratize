import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let user: { id: string }
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { markdownContent } = await request.json()

  const session = await prisma.chatSession.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.chatSession.update({
    where: { id: params.id },
    data: { markdownContent },
  })
  return NextResponse.json({ markdownContent: updated.markdownContent })
}
