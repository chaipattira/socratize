import { describe, it, expect } from 'vitest'
import { EXTRACTION_CONFIG, extractText } from '@/lib/extract-text'
import fs from 'fs'
import os from 'os'
import path from 'path'

describe('EXTRACTION_CONFIG', () => {
  it('covers pdf, docx, pptx, xlsx', () => {
    expect(EXTRACTION_CONFIG['.pdf']).toBeDefined()
    expect(EXTRACTION_CONFIG['.docx']).toBeDefined()
    expect(EXTRACTION_CONFIG['.pptx']).toBeDefined()
    expect(EXTRACTION_CONFIG['.xlsx']).toBeDefined()
  })

  it('each entry has pkg and script fields', () => {
    for (const [, config] of Object.entries(EXTRACTION_CONFIG)) {
      expect(config.pkg).toBeTruthy()
      expect(config.script).toBeTruthy()
    }
  })
})

describe('extractText', () => {
  it('returns null for unsupported extension', () => {
    const result = extractText(Buffer.from('hello'), '.csv')
    expect(result).toBeNull()
  })

  it('returns null for empty extension', () => {
    const result = extractText(Buffer.from('hello'), '')
    expect(result).toBeNull()
  })
})
