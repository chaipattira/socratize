import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWorkspaceFilename, writeWorkspaceBuffer, MAX_FILE_BYTES } from '@/lib/sandbox-tools'
import fs from 'fs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sandbox = await prisma.sandbox.findUnique({ where: { id } })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  fs.mkdirSync(sandbox.workspaceFolderPath, { recursive: true })

  const written: string[] = []
  for (const file of files) {
    if (!validateWorkspaceFilename(file.name)) continue
    if (file.size > MAX_FILE_BYTES) continue
    const buffer = Buffer.from(await file.arrayBuffer())
    writeWorkspaceBuffer(sandbox.workspaceFolderPath, file.name, buffer)
    written.push(file.name)
  }

  return NextResponse.json({ written })
}
