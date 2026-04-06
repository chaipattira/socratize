import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWorkspaceFilename, readWorkspaceFile, writeWorkspaceFile } from '@/lib/sandbox-tools'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params
  if (!validateWorkspaceFilename(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const sandbox = await prisma.sandbox.findUnique({ where: { id } })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const content = readWorkspaceFile(sandbox.workspaceFolderPath, filename)
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params
  if (!validateWorkspaceFilename(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const sandbox = await prisma.sandbox.findUnique({ where: { id } })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { content } = await request.json()
  writeWorkspaceFile(sandbox.workspaceFolderPath, filename, content ?? '')
  return NextResponse.json({ ok: true })
}
