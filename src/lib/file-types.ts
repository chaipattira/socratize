export const BINARY_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.sas7bdat',
])

export function isBinaryFile(filename: string): boolean {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return false
  const ext = filename.slice(dot).toLowerCase()
  return BINARY_EXTENSIONS.has(ext)
}
