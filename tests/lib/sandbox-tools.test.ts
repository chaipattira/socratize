import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  validateWorkspaceFilename,
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
  listSkillsAcrossFolders,
  readSkillFile,
  readSkillFilePreview,
} from '@/lib/sandbox-tools'

let tmpDir: string
let skillDir: string
let workspaceDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-test-'))
  skillDir = path.join(tmpDir, 'skills')
  workspaceDir = path.join(tmpDir, 'workspace')
  fs.mkdirSync(skillDir)
  fs.mkdirSync(workspaceDir)
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('validateWorkspaceFilename', () => {
  it('accepts simple filenames', () => {
    expect(validateWorkspaceFilename('solution.py')).toBe(true)
    expect(validateWorkspaceFilename('data.csv')).toBe(true)
    expect(validateWorkspaceFilename('notes.md')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateWorkspaceFilename('')).toBe(false)
  })

  it('rejects path traversal', () => {
    expect(validateWorkspaceFilename('../escape.py')).toBe(false)
    expect(validateWorkspaceFilename('foo/../bar.py')).toBe(false)
  })

  it('rejects absolute paths', () => {
    expect(validateWorkspaceFilename('/etc/passwd')).toBe(false)
  })

  it('rejects filenames with slashes (no subdirectories)', () => {
    expect(validateWorkspaceFilename('sub/file.py')).toBe(false)
  })
})

describe('listWorkspaceFiles', () => {
  it('returns filenames sorted alphabetically', () => {
    fs.writeFileSync(path.join(workspaceDir, 'zebra.py'), '')
    fs.writeFileSync(path.join(workspaceDir, 'apple.csv'), '')
    expect(listWorkspaceFiles(workspaceDir)).toEqual(['apple.csv', 'zebra.py'])
  })

  it('returns empty array for empty folder', () => {
    expect(listWorkspaceFiles(workspaceDir)).toEqual([])
  })
})

describe('readWorkspaceFile', () => {
  it('returns file content', () => {
    fs.writeFileSync(path.join(workspaceDir, 'code.py'), 'print("hello")')
    expect(readWorkspaceFile(workspaceDir, 'code.py')).toBe('print("hello")')
  })

  it('returns truncated content with note for large files (> 50KB)', () => {
    const big = 'x'.repeat(60000)
    fs.writeFileSync(path.join(workspaceDir, 'big.csv'), big)
    const result = readWorkspaceFile(workspaceDir, 'big.csv')
    expect(result).toContain('[truncated')
    expect(result.length).toBeLessThan(60000)
  })

  it('throws on invalid filename', () => {
    expect(() => readWorkspaceFile(workspaceDir, '../escape.py')).toThrow('Invalid filename')
  })
})

describe('writeWorkspaceFile', () => {
  it('writes file content', () => {
    writeWorkspaceFile(workspaceDir, 'out.py', 'print("done")')
    expect(fs.readFileSync(path.join(workspaceDir, 'out.py'), 'utf-8')).toBe('print("done")')
  })

  it('throws on invalid filename', () => {
    expect(() => writeWorkspaceFile(workspaceDir, '../escape.py', 'x')).toThrow('Invalid filename')
  })
})

describe('listSkillsAcrossFolders', () => {
  it('returns skill filenames from multiple folders', () => {
    const dir2 = path.join(tmpDir, 'skills2')
    fs.mkdirSync(dir2)
    fs.writeFileSync(path.join(skillDir, 'confounding-SKILL.md'), '')
    fs.writeFileSync(path.join(dir2, 'causal-SKILL.md'), '')
    fs.writeFileSync(path.join(skillDir, 'notes.md'), '') // non-skill, excluded
    const result = listSkillsAcrossFolders([skillDir, dir2])
    expect(result).toContain('confounding-SKILL.md')
    expect(result).toContain('causal-SKILL.md')
    expect(result).not.toContain('notes.md')
  })

  it('returns empty array for empty folders', () => {
    expect(listSkillsAcrossFolders([skillDir])).toEqual([])
  })

  it('returns empty array if no folders given', () => {
    expect(listSkillsAcrossFolders([])).toEqual([])
  })
})

describe('readSkillFile', () => {
  it('returns content from the first matching folder', () => {
    fs.writeFileSync(path.join(skillDir, 'confounding-SKILL.md'), '# Confounding')
    expect(readSkillFile([skillDir], 'confounding-SKILL.md')).toBe('# Confounding')
  })

  it('returns error string if file not found in any folder', () => {
    const result = readSkillFile([skillDir], 'missing-SKILL.md')
    expect(result).toMatch(/not found/)
  })

  it('returns error string on traversal filename', () => {
    expect(readSkillFile([skillDir], '../escape.md')).toMatch(/invalid filename/i)
  })
})

describe('readSkillFilePreview', () => {
  it('returns first 10 lines', () => {
    const content = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n')
    fs.writeFileSync(path.join(skillDir, 'big-SKILL.md'), content)
    const preview = readSkillFilePreview([skillDir], 'big-SKILL.md')
    const lines = preview.split('\n')
    expect(lines).toHaveLength(10)
    expect(lines[0]).toBe('line 1')
    expect(lines[9]).toBe('line 10')
  })

  it('returns full content if file has fewer than 10 lines', () => {
    fs.writeFileSync(path.join(skillDir, 'tiny-SKILL.md'), 'just one line')
    expect(readSkillFilePreview([skillDir], 'tiny-SKILL.md')).toBe('just one line')
  })

  it('returns error string if file not found', () => {
    expect(readSkillFilePreview([skillDir], 'missing-SKILL.md')).toMatch(/not found/)
  })

  it('returns error string on traversal filename', () => {
    expect(readSkillFilePreview([skillDir], '../escape.md')).toMatch(/invalid filename/i)
  })
})
