import fs from 'fs'
import path from 'path'

const docsDir = path.join(process.cwd(), 'data', 'docs')

function ensureDir() {
  fs.mkdirSync(docsDir, { recursive: true })
}

export function readDoc(sessionId: string): string {
  ensureDir()
  const p = path.join(docsDir, `${sessionId}.md`)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
}

export function writeDoc(sessionId: string, content: string): void {
  ensureDir()
  fs.writeFileSync(path.join(docsDir, `${sessionId}.md`), content, 'utf-8')
}

export function deleteDoc(sessionId: string): void {
  const p = path.join(docsDir, `${sessionId}.md`)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
