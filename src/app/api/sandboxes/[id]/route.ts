import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { getWorkspacePath } from '@/lib/sandbox-tools'

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

  // Delete workspace folder only if it's within the expected data/workspaces/ root
  const workspacesRoot = path.join(process.cwd(), 'data', 'workspaces') + path.sep
  if (
    sandbox.workspaceFolderPath &&
    sandbox.workspaceFolderPath.startsWith(workspacesRoot) &&
    fs.existsSync(sandbox.workspaceFolderPath)
  ) {
    fs.rmSync(sandbox.workspaceFolderPath, { recursive: true, force: true })
  }

  await prisma.sandbox.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
