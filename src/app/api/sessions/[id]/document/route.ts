import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeDoc } from '@/lib/local-docs'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { markdownContent } = await request.json()

  const session = await prisma.chatSession.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  writeDoc(id, markdownContent)
  return NextResponse.json({ markdownContent })
}
