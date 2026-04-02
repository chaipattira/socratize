import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const key = await prisma.apiKey.findUnique({ where: { id } })
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.apiKey.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
