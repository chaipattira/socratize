import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWorkspaceFilename, writeWorkspaceBuffer, writeWorkspaceFile, MAX_FILE_BYTES } from '@/lib/sandbox-tools'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import os from 'os'

const MAX_PDF_BYTES = 10 * 1024 * 1024 // 10 MB

function extractPdfText(pdfBuffer: Buffer): string | null {
  const tmpFile = path.join(os.tmpdir(), `sandbox-pdf-${Date.now()}.pdf`)
  const scriptPath = path.join(process.cwd(), 'scripts', 'extract_pdf_text.py')
  try {
    fs.writeFileSync(tmpFile, pdfBuffer)
    const result = spawnSync('uvx', ['--with', 'pypdf', 'python', scriptPath, tmpFile], {
      encoding: 'utf-8',
      timeout: 30_000,
    })
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
    const isPdf = file.name.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      if (file.size > MAX_PDF_BYTES) continue
      const buffer = Buffer.from(await file.arrayBuffer())
      const text = extractPdfText(buffer)
      if (!text) continue
      const txtName = file.name.replace(/\.pdf$/i, '.txt')
      if (!validateWorkspaceFilename(txtName)) continue
      writeWorkspaceFile(sandbox.workspaceFolderPath, txtName, text)
      written.push(txtName)
    } else {
      if (!validateWorkspaceFilename(file.name)) continue
      if (file.size > MAX_FILE_BYTES) continue
      const buffer = Buffer.from(await file.arrayBuffer())
      writeWorkspaceBuffer(sandbox.workspaceFolderPath, file.name, buffer)
      written.push(file.name)
    }
  }

  return NextResponse.json({ written })
}
