import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  validateFilename,
  validateSkillFilename,
  listFiles,
  readKbFile,
  writeKbFile,
  applyKbFileOps,
} from '@/lib/knowledge-base'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('validateFilename', () => {
  it('accepts simple md filenames', () => {
    expect(validateFilename('code-review.md')).toBe(true)
    expect(validateFilename('my_notes.md')).toBe(true)
  })

  it('rejects path traversal', () => {
    expect(validateFilename('../secret.md')).toBe(false)
    expect(validateFilename('foo/../bar.md')).toBe(false)
  })

  it('rejects non-md extensions', () => {
    expect(validateFilename('notes.txt')).toBe(false)
    expect(validateFilename('notes')).toBe(false)
  })

  it('rejects absolute paths', () => {
    expect(validateFilename('/etc/passwd.md')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateFilename('')).toBe(false)
  })
})

describe('listFiles', () => {
  it('returns md filenames sorted alphabetically', () => {
    fs.writeFileSync(path.join(tmpDir, 'zebra.md'), '')
    fs.writeFileSync(path.join(tmpDir, 'apple.md'), '')
    fs.writeFileSync(path.join(tmpDir, 'notes.txt'), '') // should be excluded
    const files = listFiles(tmpDir)
    expect(files).toEqual(['apple.md', 'zebra.md'])
  })

  it('returns empty array for empty folder', () => {
    expect(listFiles(tmpDir)).toEqual([])
  })

  it('includes md files in subfolders with relative paths', () => {
    fs.mkdirSync(path.join(tmpDir, 'sub'))
    fs.writeFileSync(path.join(tmpDir, 'root.md'), '')
    fs.writeFileSync(path.join(tmpDir, 'sub', 'child.md'), '')
    fs.writeFileSync(path.join(tmpDir, 'sub', 'ignored.txt'), '')
    const files = listFiles(tmpDir)
    expect(files).toEqual(['root.md', 'sub/child.md'])
  })
})

describe('readKbFile', () => {
  it('returns file content', () => {
    fs.writeFileSync(path.join(tmpDir, 'test.md'), '# Hello\n\nWorld')
    expect(readKbFile(tmpDir, 'test.md')).toBe('# Hello\n\nWorld')
  })

  it('throws on path traversal', () => {
    expect(() => readKbFile(tmpDir, '../secret.md')).toThrow('Invalid filename')
  })

  it('throws when file does not exist', () => {
    expect(() => readKbFile(tmpDir, 'missing.md')).toThrow()
  })
})

describe('writeKbFile', () => {
  it('writes file content', () => {
    writeKbFile(tmpDir, 'new.md', '# New\n\nContent')
    expect(fs.readFileSync(path.join(tmpDir, 'new.md'), 'utf-8')).toBe('# New\n\nContent')
  })

  it('throws on path traversal', () => {
    expect(() => writeKbFile(tmpDir, '../escape.md', 'x')).toThrow('Invalid filename')
  })
})

describe('applyKbFileOps', () => {
  it('applies append op to an existing file', () => {
    fs.writeFileSync(path.join(tmpDir, 'doc.md'), '# My Doc\n\n## Notes\n\nExisting.')
    applyKbFileOps(tmpDir, 'doc.md', [
      { op: 'append', section: '## Notes', content: 'New point.' },
    ])
    const result = fs.readFileSync(path.join(tmpDir, 'doc.md'), 'utf-8')
    expect(result).toContain('New point.')
    expect(result).toContain('Existing.')
  })

  it('creates the file with appended content if file does not exist', () => {
    applyKbFileOps(tmpDir, 'new.md', [
      { op: 'append', section: '## Notes', content: 'First note.' },
    ])
    const result = fs.readFileSync(path.join(tmpDir, 'new.md'), 'utf-8')
    expect(result).toContain('First note.')
  })

  it('throws on path traversal', () => {
    expect(() => applyKbFileOps(tmpDir, '../bad.md', [])).toThrow('Invalid filename')
  })
})

describe('validateSkillFilename', () => {
  it('accepts SKILL.md', () => {
    expect(validateSkillFilename('SKILL.md')).toBe(true)
  })

  it('accepts prefixed skill filenames', () => {
    expect(validateSkillFilename('code-review-SKILL.md')).toBe(true)
    expect(validateSkillFilename('debugging-SKILL.md')).toBe(true)
  })

  it('rejects plain md files', () => {
    expect(validateSkillFilename('notes.md')).toBe(false)
    expect(validateSkillFilename('code-review.md')).toBe(false)
  })

  it('rejects path traversal', () => {
    expect(validateSkillFilename('../SKILL.md')).toBe(false)
  })

  it('rejects lowercase skill.md', () => {
    expect(validateSkillFilename('skill.md')).toBe(false)
  })

  it('rejects filenames that contain but do not end with SKILL.md', () => {
    expect(validateSkillFilename('notSKILL.md')).toBe(false)
    expect(validateSkillFilename('mySKILL.md')).toBe(false)
  })

  it('rejects subdirectory paths', () => {
    expect(validateSkillFilename('sub/code-review-SKILL.md')).toBe(false)
  })
})
