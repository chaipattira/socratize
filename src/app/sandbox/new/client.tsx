'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SkillFolder {
  id: string
  title: string
  path: string
}

interface NewSandboxClientProps {
  skillFolders: SkillFolder[]
}

export function NewSandboxClient({ skillFolders }: NewSandboxClientProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleFolder = (path: string) => {
    setSelectedPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    )
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (!selected) return
    setUploadedFiles(prev => [...prev, ...Array.from(selected)])
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    setUploadedFiles(prev => [...prev, ...dropped])
  }

  const handleLaunch = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setIsCreating(true)
    setError(null)

    // Create sandbox
    const createRes = await fetch('/api/sandboxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), skillFolderPaths: selectedPaths }),
    })

    if (!createRes.ok) {
      const err = await createRes.json()
      setError(err.error ?? 'Failed to create sandbox')
      setIsCreating(false)
      return
    }

    const sandbox = await createRes.json()

    // Upload workspace files if any
    if (uploadedFiles.length > 0) {
      const formData = new FormData()
      for (const file of uploadedFiles) {
        formData.append('files', file)
      }
      const uploadRes = await fetch(`/api/sandboxes/${sandbox.id}/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) {
        setError('Sandbox created but file upload failed. You can upload files from the workspace.')
        setIsCreating(false)
        router.push(`/sandbox/${sandbox.id}`)
        return
      }
    }

    router.push(`/sandbox/${sandbox.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <span className="text-xl font-bold text-red-500">Socratize</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <button
          onClick={() => router.push('/sandbox')}
          className="text-sm text-gray-500 hover:text-gray-300 transition mb-6 block"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-semibold mb-8">New Sandbox</h1>

        <div className="space-y-8">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Epi 301 — Week 3 Homework"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* Skill folders */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Skill Folders</label>
            {skillFolders.length === 0 ? (
              <p className="text-sm text-gray-600 italic">
                No knowledge folders configured yet. Create a session with a knowledge folder path first.
              </p>
            ) : (
              <div className="space-y-2">
                {skillFolders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => toggleFolder(folder.path)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                      selectedPaths.includes(folder.path)
                        ? 'border-green-600 bg-green-950 text-green-300'
                        : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">{selectedPaths.includes(folder.path) ? '✓' : '○'}</span>
                      <div>
                        <div className="text-sm font-medium">{folder.title}</div>
                        <div className="text-xs text-gray-600 font-mono mt-0.5 truncate">{folder.path}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Workspace files */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Workspace Files</label>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-gray-600 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="text-sm text-gray-500">Drop files here or click to upload</p>
              <p className="text-xs text-gray-600 mt-1">PDFs, code files, datasets, etc.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            {uploadedFiles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {uploadedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-xs text-gray-300"
                  >
                    <span className="font-mono">{file.name}</span>
                    <button
                      onClick={e => { e.stopPropagation(); removeFile(i) }}
                      className="text-gray-600 hover:text-gray-300 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          <button
            onClick={handleLaunch}
            disabled={isCreating || !name.trim()}
            className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white font-medium py-3 rounded-lg transition"
          >
            {isCreating ? 'Creating...' : 'Launch Sandbox →'}
          </button>
        </div>
      </main>
    </div>
  )
}
