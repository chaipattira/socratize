'use client'
import { useState } from 'react'
import { isBinaryFile } from '@/lib/file-types'

interface SandboxFileTreeProps {
  sandboxId: string
  files: string[]
  activeFilename: string | null
  extractingFilename: string | null
  onFileClick: (filename: string) => void
  onFilesUploaded: (filenames: string[]) => void
}

export function SandboxFileTree({
  sandboxId,
  files,
  activeFilename,
  extractingFilename,
  onFileClick,
  onFilesUploaded,
}: SandboxFileTreeProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (!selected || selected.length === 0) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      for (const file of Array.from(selected)) {
        formData.append('files', file)
      }

      const res = await fetch(`/api/sandboxes/${sandboxId}/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)

      const { written } = await res.json() as { written: string[] }
      onFilesUploaded(written)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-xs text-stone-500 border-b border-sepia font-medium uppercase tracking-wide shrink-0 min-h-[40px] flex items-center">
        Workspace
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <p className="px-3 py-2 text-xs text-stone-400 italic">No files yet</p>
        ) : (
          files.map(f => {
            const isBinary = isBinaryFile(f)
            const isActive = f === activeFilename
            const isExtracting = f === extractingFilename
            return (
              <button
                key={f}
                onClick={() => onFileClick(f)}
                disabled={isExtracting}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate transition ${
                  isExtracting
                    ? 'text-stone-400 italic animate-pulse cursor-wait'
                    : isActive
                    ? 'bg-linen text-stone-900'
                    : isBinary
                    ? 'text-stone-300 hover:bg-linen hover:text-stone-400'
                    : 'text-stone-500 hover:bg-linen hover:text-stone-800'
                }`}
              >
                {isExtracting ? `${f} (extracting…)` : f}
              </button>
            )
          })
        )}
      </div>
      <div className="px-3 py-2 border-t border-sepia shrink-0">
        <label
          className={`text-xs text-stone-400 hover:text-wine transition w-full text-left block cursor-pointer ${isUploading ? 'opacity-40 pointer-events-none' : ''}`}
        >
          {isUploading ? 'Uploading...' : '+ Upload file'}
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
        {uploadError && (
          <p className="text-xs text-wine mt-1">{uploadError}</p>
        )}
      </div>
    </div>
  )
}
