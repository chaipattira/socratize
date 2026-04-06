import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWorkspaceFilename, writeWorkspaceBuffer, writeWorkspaceFile } from '@/lib/sandbox-tools'
import { isBinaryFile } from '@/lib/file-types'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import os from 'os'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

interface ExtractionConfig {
  pkg: string
  script: string
}

const EXTRACTION_CONFIG: Record<string, ExtractionConfig> = {
  '.pdf':  { pkg: 'pypdf',        script: 'extract_pdf_text.py' },
  '.docx': { pkg: 'python-docx',  script: 'extract_docx_text.py' },
  '.pptx': { pkg: 'markitdown',   script: 'extract_pptx_text.py' },
  '.xlsx': { pkg: 'openpyxl',     script: 'extract_xlsx_text.py' },
}

function extractText(buffer: Buffer, ext: string): string | null {
  const config = EXTRACTION_CONFIG[ext]
  if (!config) return null

  const tmpFile = path.join(os.tmpdir(), `sandbox-upload-${Date.now()}${ext}`)
  const scriptPath = path.join(process.cwd(), 'scripts', config.script)
  try {
    fs.writeFileSync(tmpFile, buffer)
    const result = spawnSync(
      'uvx',
      ['--with', config.pkg, 'python', scriptPath, tmpFile],
      { encoding: 'utf-8', timeout: 30_000 }
    )
    if (result.status !== 0) return null
    return result.stdout || null
  } catch {
    return null
  } finally {
    try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}

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
