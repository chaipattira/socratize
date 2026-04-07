import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { EXTRACTION_CONFIG, extractText } from '@/lib/extract-text'

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

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true })
  } catch {
    return NextResponse.json({ error: 'Cannot read directory' }, { status: 500 })
  }

  const extracted: string[] = []

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue
    const dot = entry.name.lastIndexOf('.')
    if (dot === -1) continue
    const ext = entry.name.slice(dot).toLowerCase()
    if (!EXTRACTION_CONFIG[ext]) continue

    const companionName = `${entry.name}.txt`
    const companionPath = path.join(folderPath, companionName)
    if (fs.existsSync(companionPath)) continue

    try {
      const buffer = fs.readFileSync(path.join(folderPath, entry.name))
      const text = extractText(buffer, ext)
      if (text) {
        fs.writeFileSync(companionPath, text, 'utf-8')
        extracted.push(companionName)
      }
    } catch {
      // Skip files that fail — don't abort the whole batch
    }
  }

  return NextResponse.json({ extracted })
}
