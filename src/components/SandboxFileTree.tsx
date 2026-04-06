'use client'
import { useState } from 'react'

interface SandboxFileTreeProps {
  sandboxId: string
  files: string[]
  activeFilename: string | null
  onFileClick: (filename: string) => void
  onFilesUploaded: (filenames: string[]) => void
}

export function SandboxFileTree({
  sandboxId,
  files,
  activeFilename,
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
      <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-800 font-medium uppercase tracking-wide shrink-0">
        Workspace
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-600 italic">No files yet</p>
        ) : (
          files.map(f => (
            <button
              key={f}
              onClick={() => onFileClick(f)}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate transition ${
                f === activeFilename
                  ? 'bg-gray-800 text-gray-100'
                  : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
              }`}
            >
              {f}
            </button>
          ))
        )}
      </div>
      <div className="px-3 py-2 border-t border-gray-800 shrink-0">
        <label
          className={`text-xs text-gray-500 hover:text-gray-300 transition w-full text-left block cursor-pointer ${isUploading ? 'opacity-40 pointer-events-none' : ''}`}
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
          <p className="text-xs text-red-400 mt-1">{uploadError}</p>
        )}
      </div>
    </div>
  )
}
