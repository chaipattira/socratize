import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWorkspaceFilename, writeWorkspaceFile } from '@/lib/sandbox-tools'
import { EXTRACTION_CONFIG, extractText } from '@/lib/extract-text'
import fs from 'fs'
import path from 'path'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params

  if (!validateWorkspaceFilename(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (!EXTRACTION_CONFIG[ext]) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  const sandbox = await prisma.sandbox.findUnique({ where: { id } })
  if (!sandbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = path.join(sandbox.workspaceFolderPath, filename)
  let buffer: Buffer
  try {
    buffer = fs.readFileSync(filePath)
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const text = extractText(buffer, ext)
  if (!text) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 422 })
  }

  const companionName = `${filename}.txt`
  if (!validateWorkspaceFilename(companionName)) {
    return NextResponse.json({ error: 'Invalid companion filename' }, { status: 400 })
  }

  writeWorkspaceFile(sandbox.workspaceFolderPath, companionName, text)
  return NextResponse.json({ companionName })
}
