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

interface NewSessionDialogProps {
  onClose: () => void
}

export function NewSessionDialog({ onClose }: NewSessionDialogProps) {
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
    } catch {
      setFolderError('Failed to check directory')
    } finally {
      setIsCheckingFolder(false)
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

  const modes: { value: ExtractionMode; label: string; description: string }[] = [
    { value: 'interview', label: 'Interview', description: 'Conversation to surface and document your expertise' },
    { value: 'socratize', label: 'Build a skill', description: 'Extract and write skill files for your agent' },
  ]

  const canSubmit = !!title.trim() && !!folderPath.trim()

  const inputClass = 'w-full bg-parchment border border-sepia rounded px-4 py-2.5 text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition'

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-parchment border border-sepia rounded-xl p-8 w-full max-w-md mx-4 shadow-sm">
        <h2 className="font-display text-2xl font-normal text-stone-900 mb-6">New Interview</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">What knowledge do you want to capture?</label>
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
                className={`flex-1 bg-parchment border rounded px-4 py-2.5 text-sm text-stone-900 placeholder-stone-300 focus:outline-none font-mono transition ${
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
            <p className="text-xs text-stone-400 mt-1">Absolute path to a folder of .md files. The folder can be empty.</p>

            {folderError && (
              <p className="text-xs text-wine mt-1">{folderError}</p>
            )}

            {folderVerified && (
              <div className="mt-2 rounded border border-sepia overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-sepia bg-vellum">
                  <span className="text-xs text-stone-500 font-medium">
                    {folderFiles.length === 0 ? 'Empty folder' : `${folderFiles.length} .md file${folderFiles.length !== 1 ? 's' : ''}`}
                  </span>
                  <span className="text-xs text-wine/60">✓ Found</span>
                </div>
                {folderFiles.length > 0 && (
                  <div className="max-h-40 overflow-y-auto py-1 bg-parchment">
                    {folderFiles.map(f => (
                      <div key={f} className="px-3 py-1 text-xs text-stone-400 font-mono hover:text-stone-600 transition">
                        {f}
                      </div>
                    ))}
                  </div>
                )}
                {folderFiles.length === 0 && (
                  <div className="px-3 py-2 text-xs text-stone-400 italic bg-parchment">
                    No .md files yet — the agent will create them.
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">How do you want to start?</label>
            <div className="grid grid-cols-2 gap-2">
              {modes.map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setExtractionMode(mode.value)}
                  className={`px-3 py-3 rounded text-sm text-left border transition ${
                    extractionMode === mode.value
                      ? 'bg-wine/8 border-wine/40 text-wine'
                      : 'bg-parchment border-sepia text-stone-500 hover:border-stone-400'
                  }`}
                >
                  <div className="font-medium mb-0.5">{mode.label}</div>
                  <div className="text-xs opacity-70">{mode.description}</div>
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

          {error && <p className="text-wine text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-vellum hover:bg-linen text-stone-600 text-sm py-2.5 rounded transition border border-sepia"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="flex-1 bg-wine hover:bg-wine-hover disabled:opacity-40 text-parchment text-sm py-2.5 rounded font-medium transition"
            >
              {loading ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
