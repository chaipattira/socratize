'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface NewSessionDialogProps {
  onClose: () => void
}

export function NewSessionDialog({ onClose }: NewSessionDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [provider, setProvider] = useState('anthropic')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [extractionMode, setExtractionMode] = useState<'guided' | 'direct'>('guided')
  const [folderPath, setFolderPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleProviderChange = (p: string) => {
    setProvider(p)
    setModel(p === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), llmProvider: provider, model, extractionMode, knowledgeFolderPath: folderPath.trim() }),
    })

    if (!res.ok) {
      setError('Failed to create session')
      setLoading(false)
      return
    }

    const session = await res.json()
    router.push(`/sessions/${session.id}`)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-6">New Session</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-2">What knowledge do you want to capture?</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. How I do code review"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Knowledge base folder path</label>
            <input
              value={folderPath}
              onChange={e => setFolderPath(e.target.value)}
              placeholder="/absolute/path/to/your/notes"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 font-mono"
            />
            <p className="text-xs text-gray-600 mt-1">Absolute path to a folder of .md files. The folder can be empty.</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">How do you want to start?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExtractionMode('guided')}
                className={`px-3 py-3 rounded-lg text-sm text-left border transition ${
                  extractionMode === 'guided'
                    ? 'bg-red-600/20 border-red-500 text-red-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="font-medium mb-0.5">Help me discover it</div>
                <div className="text-xs opacity-70">I'll be asked questions to surface what I know</div>
              </button>
              <button
                type="button"
                onClick={() => setExtractionMode('direct')}
                className={`px-3 py-3 rounded-lg text-sm text-left border transition ${
                  extractionMode === 'direct'
                    ? 'bg-red-600/20 border-red-500 text-red-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="font-medium mb-0.5">I know what to include</div>
                <div className="text-xs opacity-70">I'll walk through the steps myself</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">LLM Provider</label>
            <select
              value={provider}
              onChange={e => handleProviderChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Model</label>
            <input
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-sm py-2.5 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !folderPath.trim()}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm py-2.5 rounded-lg font-medium transition"
            >
              {loading ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
