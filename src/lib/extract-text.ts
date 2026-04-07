import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import os from 'os'

export interface ExtractionConfig {
  pkg: string
  script: string
}

export const EXTRACTION_CONFIG: Record<string, ExtractionConfig> = {
  '.pdf':  { pkg: 'pypdf',        script: 'extract_pdf_text.py' },
  '.docx': { pkg: 'python-docx',  script: 'extract_docx_text.py' },
  '.pptx': { pkg: 'markitdown',   script: 'extract_pptx_text.py' },
  '.xlsx': { pkg: 'openpyxl',     script: 'extract_xlsx_text.py' },
}

export function extractText(buffer: Buffer, ext: string): string | null {
  const config = EXTRACTION_CONFIG[ext]
  if (!config) return null

  const tmpFile = path.join(os.tmpdir(), `sandbox-upload-${Date.now()}${ext}`)
  const scriptPath = path.join(process.cwd(), 'scripts', config.script)
  try {
    fs.writeFileSync(tmpFile, buffer)
    const result = spawnSync(
      'uvx',
      ['--with', config.pkg, 'python', scriptPath, tmpFile],
      { encoding: 'utf-8', timeout: 30_000 }
    )
    if (result.status !== 0) return null
    return result.stdout || null
  } catch {
    return null
  } finally {
    try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}
