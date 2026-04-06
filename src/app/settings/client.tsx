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

  const inputClass = 'w-full bg-parchment border border-sepia rounded px-4 py-2.5 text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition'

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-sepia px-8 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-stone-400 hover:text-stone-700 text-sm transition">
          ← Dashboard
        </button>
        <span className="font-display text-xl italic text-wine">Socratize</span>
      </header>

      <main className="max-w-xl mx-auto px-8 py-12">
        {isSetup && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded px-4 py-3 text-sm text-amber-700">
            No API key found. Please add one below to start using Socratize.
          </div>
        )}

        <h2 className="font-display text-4xl font-normal text-stone-900 mb-2">Settings</h2>
        <p className="text-stone-400 text-sm mb-10">
          Keys are encrypted at rest. Required to start extraction sessions.
        </p>

        {keys.length > 0 && (
          <div className="mb-8 divide-y divide-sepia border border-sepia rounded overflow-hidden">
            {keys.map(k => (
              <div key={k.id} className="flex justify-between items-center bg-parchment px-4 py-3 text-sm">
                <span className="capitalize text-stone-700">{k.provider} key saved</span>
                <button onClick={() => handleDelete(k.id)} className="text-stone-300 hover:text-wine transition text-xs">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5 bg-vellum border border-sepia rounded p-6">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">Provider</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className={inputClass}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">API Key</label>
            <input
              type="password"
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
              placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
              className={`${inputClass} font-mono`}
            />
          </div>
          {message && (
            <p className={`text-sm ${message === 'Saved!' ? 'text-wine/70' : 'text-wine'}`}>{message}</p>
          )}
          <button
            type="submit"
            disabled={saving || !keyValue.trim()}
            className="w-full bg-wine hover:bg-wine-hover disabled:opacity-40 text-parchment text-sm font-medium py-2.5 rounded transition"
          >
            {saving ? 'Saving...' : 'Save Key'}
          </button>
        </form>
      </main>
    </div>
  )
}
