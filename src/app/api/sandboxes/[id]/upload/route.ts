import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWorkspaceFilename, writeWorkspaceBuffer, writeWorkspaceFile } from '@/lib/sandbox-tools'
import { isBinaryFile } from '@/lib/file-types'
import { EXTRACTION_CONFIG, extractText } from '@/lib/extract-text'
import fs from 'fs'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

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
    if (file.size > MAX_UPLOAD_BYTES) continue

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()

    // Always save the original
    writeWorkspaceBuffer(sandbox.workspaceFolderPath, file.name, buffer)
    written.push(file.name)

    // For supported binary types, also extract a readable companion
    if (EXTRACTION_CONFIG[ext]) {
      const text = extractText(buffer, ext)
      if (text) {
        const companionName = `${file.name}.txt`
        if (validateWorkspaceFilename(companionName)) {
          writeWorkspaceFile(sandbox.workspaceFolderPath, companionName, text)
          written.push(companionName)
        }
      }
    }
  }

  return NextResponse.json({ written })
}
