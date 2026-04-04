'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface ApiKey { id: string; provider: string }

export default function SettingsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isSetup = searchParams.get('setup') === '1'
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [provider, setProvider] = useState('anthropic')
  const [keyValue, setKeyValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/keys').then(r => r.json()).then(setKeys)
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key: keyValue }),
    })
    if (res.ok) {
      const newKey = await res.json()
      setKeys(prev => [...prev.filter(k => k.provider !== provider), newKey])
      setKeyValue('')
      setMessage('Saved!')
    } else {
      setMessage('Failed to save key')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-300 text-sm transition">
          ← Dashboard
        </button>
        <span className="text-lg font-semibold">Settings</span>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10">
        {isSetup && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-sm text-yellow-300">
            No API key found. Please add one below to start using Socratize.
          </div>
        )}
        <h2 className="text-lg font-semibold mb-2">API Keys</h2>
        <p className="text-gray-500 text-sm mb-6">
          Keys are encrypted at rest. Required to start extraction sessions.
        </p>

        {keys.length > 0 && (
          <div className="mb-6 space-y-2">
            {keys.map(k => (
              <div key={k.id} className="flex justify-between items-center bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm">
                <span className="capitalize">{k.provider} key saved</span>
                <button onClick={() => handleDelete(k.id)} className="text-gray-600 hover:text-red-400 transition text-xs">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Provider</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">API Key</label>
            <input
              type="password"
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
              placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-gray-500"
            />
          </div>
          {message && <p className={`text-sm ${message === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}
          <button
            type="submit"
            disabled={saving || !keyValue.trim()}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm font-medium py-2.5 rounded-lg transition"
          >
            {saving ? 'Saving...' : 'Save Key'}
          </button>
        </form>
      </main>
    </div>
  )
}
