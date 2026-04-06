import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { listWorkspaceFiles } from '@/lib/sandbox-tools'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sandbox = await prisma.sandbox.findUnique({ where: { id } })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const files = listWorkspaceFiles(sandbox.workspaceFolderPath)
  return NextResponse.json({ files })
}
