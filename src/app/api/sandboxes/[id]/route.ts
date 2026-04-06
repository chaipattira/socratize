import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sandbox = await prisma.sandbox.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(sandbox)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sandbox = await prisma.sandbox.findUnique({ where: { id } })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete workspace folder
  if (sandbox.workspaceFolderPath && fs.existsSync(sandbox.workspaceFolderPath)) {
    fs.rmSync(sandbox.workspaceFolderPath, { recursive: true, force: true })
  }

  await prisma.sandbox.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
