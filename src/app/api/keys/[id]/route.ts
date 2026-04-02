import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let user: { id: string }
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = await prisma.apiKey.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.apiKey.delete({ where: { id: params.id } })
  return new NextResponse(null, { status: 204 })
}
