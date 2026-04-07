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

export const UNSUPPORTED_PREVIEW_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.tiff',
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.mp3', '.wav', '.ogg', '.flac', '.aac',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
])

export function isUnsupportedPreviewFile(filename: string): boolean {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return false
  return UNSUPPORTED_PREVIEW_EXTENSIONS.has(filename.slice(dot).toLowerCase())
}
