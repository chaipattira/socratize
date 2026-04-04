import fs from 'fs'
import path from 'path'
import { applyDocOps, type DocOp } from '@/lib/doc-ops'

export function validateFilename(filename: string): boolean {
  if (!filename || filename.startsWith('/')) return false
  if (!filename.endsWith('.md')) return false
  // Reject any path containing .. segments
  if (filename.includes('..')) return false
  // Resolve to check for traversal: the resolved path must stay inside a sentinel dir
  const resolved = path.resolve('/sentinel', filename)
  if (!resolved.startsWith('/sentinel/')) return false
  return true
}

export function validateSkillFilename(filename: string): boolean {
  if (!validateFilename(filename)) return false
  if (filename.includes('/')) return false // flat filenames only
  return filename === 'SKILL.md' || filename.endsWith('-SKILL.md')
}

export function listFiles(folderPath: string, prefix = ''): string[] {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...listFiles(path.join(folderPath, entry.name), relative))
    } else if (entry.name.endsWith('.md')) {
      files.push(relative)
    }
  }
  return files.sort()
}

export function readKbFile(folderPath: string, filename: string): string {
  if (!validateFilename(filename)) throw new Error('Invalid filename')
  return fs.readFileSync(path.join(folderPath, filename), 'utf-8')
}

export function writeKbFile(folderPath: string, filename: string, content: string): void {
  if (!validateFilename(filename)) throw new Error('Invalid filename')
  fs.writeFileSync(path.join(folderPath, filename), content, 'utf-8')
}

export function applyKbFileOps(folderPath: string, filename: string, ops: DocOp[]): void {
  if (!validateFilename(filename)) throw new Error('Invalid filename')
  const filePath = path.join(folderPath, filename)
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''
  const updated = applyDocOps(existing, ops)
  fs.writeFileSync(filePath, updated, 'utf-8')
}
