import fs from 'fs'
import path from 'path'

const BUILTIN_SKILLS_DIR = path.join(process.cwd(), 'src', 'lib', 'builtin-skills')

export const MAX_FILE_BYTES = 50 * 1024 // 50KB

export function getWorkspacePath(sandboxId: string): string {
  return path.join(process.cwd(), 'data', 'workspaces', sandboxId)
}

export function validateWorkspaceFilename(filename: string): boolean {
  if (!filename) return false
  if (filename.startsWith('/')) return false
  if (filename.includes('..')) return false
  if (filename.includes('/')) return false
  // Resolve to check for traversal
  const resolved = path.resolve('/sentinel', filename)
  if (!resolved.startsWith('/sentinel/')) return false
  return true
}

export function listWorkspaceFiles(workspacePath: string): string[] {
  if (!fs.existsSync(workspacePath)) return []
  return fs
    .readdirSync(workspacePath, { withFileTypes: true })
    .filter(e => e.isFile())
    .map(e => e.name)
    .sort()
}

export function readWorkspaceFile(workspacePath: string, filename: string): string {
  if (!validateWorkspaceFilename(filename)) throw new Error('Invalid filename')
  const filePath = path.join(workspacePath, filename)
  const stat = fs.statSync(filePath)
  if (stat.size > MAX_FILE_BYTES) {
    const content = fs.readFileSync(filePath)
    return content.slice(0, MAX_FILE_BYTES).toString('utf-8') +
      `\n\n[truncated — file is ${stat.size} bytes, showing first ${MAX_FILE_BYTES} bytes]`
  }
  return fs.readFileSync(filePath, 'utf-8')
}

export function writeWorkspaceFile(workspacePath: string, filename: string, content: string): void {
  if (!validateWorkspaceFilename(filename)) throw new Error('Invalid filename')
  fs.mkdirSync(workspacePath, { recursive: true })
  fs.writeFileSync(path.join(workspacePath, filename), content, 'utf-8')
}

export function writeWorkspaceBuffer(workspacePath: string, filename: string, buffer: Buffer): void {
  if (!validateWorkspaceFilename(filename)) throw new Error('Invalid filename')
  fs.mkdirSync(workspacePath, { recursive: true })
  fs.writeFileSync(path.join(workspacePath, filename), buffer)
}

function validateSkillFilename(filename: string): boolean {
  if (!filename) return false
  if (path.isAbsolute(filename)) return false
  const normalized = path.normalize(filename)
  if (normalized.startsWith('..')) return false
  return true
}

export function listSkillsAcrossFolders(folderPaths: string[]): string[] {
  const skills: string[] = []

  function collect(dir: string, prefix: string, depth: number) {
    if (depth > 4) return
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isFile() && entry.name.endsWith('.md')) {
        if (!skills.includes(rel)) skills.push(rel)
      } else if (entry.isDirectory()) {
        collect(path.join(dir, entry.name), rel, depth + 1)
      }
    }
  }

  // Always include built-in skills first
  collect(BUILTIN_SKILLS_DIR, 'builtin', 0)

  for (const folder of folderPaths) {
    if (!fs.existsSync(folder)) continue
    collect(folder, '', 0)
  }
  return skills.sort()
}

function findSkillFile(folderPaths: string[], filename: string): string | null {
  // Resolve builtin/ prefix to the built-in skills directory
  if (filename.startsWith('builtin/')) {
    const builtinRelative = filename.slice('builtin/'.length)
    const builtinPath = path.join(BUILTIN_SKILLS_DIR, builtinRelative)
    try {
      if (fs.existsSync(builtinPath) && fs.statSync(builtinPath).isFile()) return builtinPath
    } catch { /* skip */ }
    return null
  }

  for (const folder of folderPaths) {
    const filePath = path.join(folder, filename)
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath
    } catch { /* skip */ }
  }
  return null
}

export function readSkillFile(folderPaths: string[], filename: string): string {
  if (!validateSkillFilename(filename)) return `Error: skill file "${filename}" — invalid filename`
  const filePath = findSkillFile(folderPaths, filename)
  if (!filePath) return `Error: skill file "${filename}" not found in any configured folder`
  return fs.readFileSync(filePath, 'utf-8')
}

export function readSkillFilePreview(folderPaths: string[], filename: string): string {
  if (!validateSkillFilename(filename)) return `Error: skill file "${filename}" — invalid filename`
  const filePath = findSkillFile(folderPaths, filename)
  if (!filePath) return `Error: skill file "${filename}" not found in any configured folder`
  const content = fs.readFileSync(filePath, 'utf-8')
  return content.split('\n').slice(0, 10).join('\n')
}
