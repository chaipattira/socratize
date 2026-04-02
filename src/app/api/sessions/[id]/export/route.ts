import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let user: { id: string }
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await prisma.chatSession.findFirst({
    where: { id: params.id, userId: user.id },
    select: { title: true, markdownContent: true },
  })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filename = session.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return new NextResponse(session.markdownContent, {
    headers: {
      'Content-Type': 'text/markdown',
      'Content-Disposition': `attachment; filename="${filename}.md"`,
    },
  })
}
