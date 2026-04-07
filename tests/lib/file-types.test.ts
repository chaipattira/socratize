import { describe, it, expect } from 'vitest'
import {
  isBinaryFile,
  BINARY_EXTENSIONS,
  isUnsupportedPreviewFile,
  UNSUPPORTED_PREVIEW_EXTENSIONS,
} from '@/lib/file-types'

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

describe('UNSUPPORTED_PREVIEW_EXTENSIONS', () => {
  it('contains common image types', () => {
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.png')).toBe(true)
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.jpg')).toBe(true)
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.gif')).toBe(true)
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.webp')).toBe(true)
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.svg')).toBe(true)
  })

  it('contains common video types', () => {
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.mp4')).toBe(true)
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.mov')).toBe(true)
  })

  it('contains common audio types', () => {
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.mp3')).toBe(true)
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.wav')).toBe(true)
  })

  it('contains common archive types', () => {
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.zip')).toBe(true)
    expect(UNSUPPORTED_PREVIEW_EXTENSIONS.has('.tar')).toBe(true)
  })
})

describe('isUnsupportedPreviewFile', () => {
  it('returns true for image files', () => {
    expect(isUnsupportedPreviewFile('photo.png')).toBe(true)
    expect(isUnsupportedPreviewFile('anim.gif')).toBe(true)
    expect(isUnsupportedPreviewFile('shot.jpg')).toBe(true)
  })

  it('returns true for video files', () => {
    expect(isUnsupportedPreviewFile('clip.mp4')).toBe(true)
    expect(isUnsupportedPreviewFile('video.mov')).toBe(true)
  })

  it('returns true for archive files', () => {
    expect(isUnsupportedPreviewFile('bundle.zip')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isUnsupportedPreviewFile('IMAGE.PNG')).toBe(true)
    expect(isUnsupportedPreviewFile('Video.MP4')).toBe(true)
  })

  it('returns false for text files', () => {
    expect(isUnsupportedPreviewFile('notes.md')).toBe(false)
    expect(isUnsupportedPreviewFile('script.ts')).toBe(false)
  })

  it('returns false for extractable binary files', () => {
    // isBinaryFile handles these; isUnsupportedPreviewFile must not overlap
    expect(isUnsupportedPreviewFile('report.pdf')).toBe(false)
    expect(isUnsupportedPreviewFile('doc.docx')).toBe(false)
  })

  it('returns false for files with no extension', () => {
    expect(isUnsupportedPreviewFile('Makefile')).toBe(false)
  })
})
