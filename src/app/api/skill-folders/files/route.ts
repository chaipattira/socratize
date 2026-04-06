import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function collectMdFiles(dir: string, depth = 0): string[] {
  if (depth > 3) return []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const results: string[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(entry.name)
      } else if (entry.isDirectory()) {
        const sub = collectMdFiles(path.join(dir, entry.name), depth + 1)
        for (const f of sub) results.push(`${entry.name}/${f}`)
      }
    }
    return results.sort()
  } catch {
    return []
  }
}

export async function GET(request: Request) {
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

  const files = collectMdFiles(folderPath).map(name => ({ name }))
  return NextResponse.json({ files })
}
