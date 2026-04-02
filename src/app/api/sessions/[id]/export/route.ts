import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readDoc } from '@/lib/local-docs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.chatSession.findUnique({
    where: { id },
    select: { title: true },
  })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const markdownContent = readDoc(id)
  const filename = session.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return new NextResponse(markdownContent, {
    headers: {
      'Content-Type': 'text/markdown',
      'Content-Disposition': `attachment; filename="${filename}.md"`,
    },
  })
}
