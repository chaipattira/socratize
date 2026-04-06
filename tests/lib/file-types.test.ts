import { describe, it, expect } from 'vitest'
import { isBinaryFile, BINARY_EXTENSIONS } from '@/lib/file-types'

describe('BINARY_EXTENSIONS', () => {
  it('contains all supported binary types', () => {
    expect(BINARY_EXTENSIONS.has('.pdf')).toBe(true)
    expect(BINARY_EXTENSIONS.has('.docx')).toBe(true)
    expect(BINARY_EXTENSIONS.has('.pptx')).toBe(true)
    expect(BINARY_EXTENSIONS.has('.xlsx')).toBe(true)
    expect(BINARY_EXTENSIONS.has('.sas7bdat')).toBe(true)
  })
})

describe('isBinaryFile', () => {
  it('returns true for binary extensions', () => {
    expect(isBinaryFile('report.docx')).toBe(true)
    expect(isBinaryFile('slides.pptx')).toBe(true)
    expect(isBinaryFile('data.xlsx')).toBe(true)
    expect(isBinaryFile('study.pdf')).toBe(true)
    expect(isBinaryFile('dataset.sas7bdat')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isBinaryFile('Report.DOCX')).toBe(true)
    expect(isBinaryFile('DATA.PDF')).toBe(true)
  })

  it('returns false for text files', () => {
    expect(isBinaryFile('solution.py')).toBe(false)
    expect(isBinaryFile('notes.txt')).toBe(false)
    expect(isBinaryFile('data.csv')).toBe(false)
    expect(isBinaryFile('report.docx.txt')).toBe(false)
  })

  it('returns false for files with no extension', () => {
    expect(isBinaryFile('Makefile')).toBe(false)
  })
})
