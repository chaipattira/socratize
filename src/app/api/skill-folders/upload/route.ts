import { NextResponse } from 'next/server'
import fs from 'fs'
import { validateWorkspaceFilename, writeWorkspaceBuffer, writeWorkspaceFile } from '@/lib/sandbox-tools'
import { EXTRACTION_CONFIG, extractText } from '@/lib/extract-text'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const folderPath = searchParams.get('path')

  if (!folderPath) {
    return NextResponse.json({ error: 'path required' }, { status: 400 })
  }

  let stat: fs.Stats
  try {
    stat = fs.statSync(folderPath)
  } catch {
    return NextResponse.json({ error: 'Directory not found' }, { status: 404 })
  }

  if (!stat.isDirectory()) {
    return NextResponse.json({ error: 'Not a directory' }, { status: 400 })
  }

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  const written: string[] = []

  for (const file of files) {
    if (!validateWorkspaceFilename(file.name)) continue
    if (file.size > MAX_UPLOAD_BYTES) continue

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()

    writeWorkspaceBuffer(folderPath, file.name, buffer)
    written.push(file.name)

    if (EXTRACTION_CONFIG[ext]) {
      const text = extractText(buffer, ext)
      if (text) {
        const companionName = `${file.name}.txt`
        if (validateWorkspaceFilename(companionName)) {
          writeWorkspaceFile(folderPath, companionName, text)
          written.push(companionName)
        }
      }
    }
  }

  return NextResponse.json({ written })
}
