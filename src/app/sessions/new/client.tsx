'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const MODELS: Record<string, { label: string; value: string }[]> = {
  anthropic: [
    { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
  ],
  openai: [
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4o mini', value: 'gpt-4o-mini' },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  ],
}

type ExtractionMode = 'interview' | 'socratize'

const modes: { value: ExtractionMode; label: string; description: string }[] = [
  { value: 'interview', label: 'Interview', description: 'Conversation to surface and document your expertise' },
  { value: 'socratize', label: 'Build a skill', description: 'Extract and write skill files for your agent' },
]

export function NewSessionClient() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [provider, setProvider] = useState('anthropic')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>('interview')
  const [folderPath, setFolderPath] = useState('')
  const [folderFiles, setFolderFiles] = useState<string[]>([])
  const [folderError, setFolderError] = useState<string | null>(null)
  const [isCheckingFolder, setIsCheckingFolder] = useState(false)
  const [folderVerified, setFolderVerified] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleProviderChange = (p: string) => {
    setProvider(p)
    setModel(MODELS[p][0].value)
  }

  const handleFolderPathChange = (value: string) => {
    setFolderPath(value)
    setFolderError(null)
    setFolderVerified(false)
    setFolderFiles([])
  }

  const refreshFolderFiles = async (trimmed: string) => {
    const res = await fetch(`/api/skill-folders/files?path=${encodeURIComponent(trimmed)}`)
    if (!res.ok) return
    const { files } = await res.json() as { files: { name: string }[] }
    setFolderFiles(files.map(f => f.name))
  }

  const handleAddFolder = async () => {
    const trimmed = folderPath.trim()
    if (!trimmed) return
    setIsCheckingFolder(true)
    setFolderError(null)
    setFolderVerified(false)
    setFolderFiles([])

    try {
      const res = await fetch(`/api/skill-folders/files?path=${encodeURIComponent(trimmed)}`)
      if (!res.ok) {
        const body = await res.json()
        setFolderError(body.error ?? 'Directory not found')
        return
      }
      const { files } = await res.json() as { files: { name: string }[] }
      setFolderFiles(files.map(f => f.name))
      setFolderVerified(true)

      // Extract existing binary files, then refresh to pick up new companions
      await fetch(`/api/skill-folders/extract?path=${encodeURIComponent(trimmed)}`, { method: 'POST' })
      await refreshFolderFiles(trimmed)
    } catch {
      setFolderError('Failed to check directory')
    } finally {
      setIsCheckingFolder(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (!selected || selected.length === 0) return
    const trimmed = folderPath.trim()

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      for (const file of Array.from(selected)) {
        formData.append('files', file)
      }

      const res = await fetch(`/api/skill-folders/upload?path=${encodeURIComponent(trimmed)}`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)

      await refreshFolderFiles(trimmed)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        llmProvider: provider,
        model,
        extractionMode,
        knowledgeFolderPath: folderPath.trim(),
      }),
    })

    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to create session')
      setLoading(false)
      return
    }

    const session = await res.json()
    router.push(`/sessions/${session.id}`)
  }

  const canSubmit = !!title.trim() && !!folderPath.trim()

  const inputClass = 'w-full bg-parchment border border-sepia rounded px-4 py-2.5 text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition'

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-sepia px-8 py-4 flex justify-between items-center">
        <span className="font-display text-xl italic text-wine tracking-wide">Socratize</span>
      </header>

      <main className="max-w-xl mx-auto px-8 py-12">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-stone-400 hover:text-stone-700 transition mb-8 block"
        >
          ← Back
        </button>

        <h1 className="font-display text-4xl font-normal text-stone-900 mb-10">New Session</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">
              What knowledge do you want to capture?
            </label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. How I do code review"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">
              Knowledge base folder path
            </label>
            <div className="flex gap-2">
              <input
                value={folderPath}
                onChange={e => handleFolderPathChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddFolder() } }}
                placeholder="/absolute/path/to/your/notes"
                className={`flex-1 bg-parchment border rounded px-4 py-2.5 text-sm text-stone-900 placeholder-stone-300 focus:outline-none transition font-mono ${
                  folderVerified ? 'border-wine/40 focus:border-wine/60' : 'border-sepia focus:border-stone-400'
                }`}
              />
              <button
                type="button"
                onClick={handleAddFolder}
                disabled={!folderPath.trim() || isCheckingFolder}
                className="px-3 py-2 bg-vellum hover:bg-linen disabled:opacity-40 text-stone-600 text-sm rounded transition border border-sepia shrink-0"
              >
                {isCheckingFolder ? '...' : 'Add'}
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-1">Absolute path to a folder of files. The folder can be empty.</p>

            {folderError && (
              <p className="text-xs text-wine mt-1">{folderError}</p>
            )}

            {folderVerified && extractionMode === 'socratize' && (
              <div className="mt-2 rounded border border-sepia bg-parchment overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-sepia bg-vellum">
                  <span className="text-xs text-stone-500 font-medium">
                    {folderFiles.filter(f => f.endsWith('.md')).length === 0
                      ? 'Empty folder'
                      : `${folderFiles.filter(f => f.endsWith('.md')).length} .md file${folderFiles.filter(f => f.endsWith('.md')).length !== 1 ? 's' : ''}`}
                  </span>
                  <span className="text-xs text-wine/60">✓ Found</span>
                </div>
                {folderFiles.filter(f => f.endsWith('.md')).length > 0 && (
                  <div className="max-h-40 overflow-y-auto py-1">
                    {folderFiles.filter(f => f.endsWith('.md')).map(f => (
                      <div key={f} className="px-3 py-1 text-xs text-stone-400 font-mono hover:text-stone-600 transition">
                        {f}
                      </div>
                    ))}
                  </div>
                )}
                {folderFiles.filter(f => f.endsWith('.md')).length === 0 && (
                  <div className="px-3 py-2 text-xs text-stone-400 italic">
                    No .md files yet — the agent will create them.
                  </div>
                )}
              </div>
            )}

            {folderVerified && extractionMode !== 'socratize' && (
              <div className="mt-2 rounded border border-sepia bg-parchment overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-sepia bg-vellum">
                  <span className="text-xs text-stone-500 font-medium">
                    {folderFiles.length === 0 ? 'Empty folder' : `${folderFiles.length} file${folderFiles.length !== 1 ? 's' : ''} found`}
                  </span>
                  <span className="text-xs text-wine/60">✓ Found</span>
                </div>
                <div className="px-3 py-2">
                  <label className={`text-xs text-stone-400 hover:text-wine transition cursor-pointer ${isUploading ? 'opacity-40 pointer-events-none' : ''}`}>
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
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">How do you want to start?</label>
            <div className="grid grid-cols-2 gap-3">
              {modes.map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setExtractionMode(mode.value)}
                  className={`px-4 py-4 rounded text-sm text-left border transition ${
                    extractionMode === mode.value
                      ? 'bg-wine/8 border-wine/40 text-wine'
                      : 'bg-parchment border-sepia text-stone-500 hover:border-stone-400'
                  }`}
                >
                  <div className="font-medium mb-1">{mode.label}</div>
                  <div className="text-xs opacity-70 leading-relaxed">{mode.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">LLM Provider</label>
            <select
              value={provider}
              onChange={e => handleProviderChange(e.target.value)}
              className={inputClass}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className={inputClass}
            >
              {MODELS[provider].map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-wine text-sm bg-wine/5 border border-wine/20 rounded px-4 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full bg-wine hover:bg-wine-hover disabled:opacity-40 text-parchment font-medium py-3 rounded transition"
          >
            {loading ? 'Starting...' : 'Start Session →'}
          </button>
        </form>
      </main>
    </div>
  )
}
