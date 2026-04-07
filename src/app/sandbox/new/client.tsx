'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewSandboxClient() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Single skill folder
  const [skillFolderPath, setSkillFolderPath] = useState('')
  const [skillFolderVerified, setSkillFolderVerified] = useState(false)
  const [skillFolderError, setSkillFolderError] = useState<string | null>(null)
  const [skillFolderFiles, setSkillFolderFiles] = useState<string[]>([])
  const [isCheckingSkillFolder, setIsCheckingSkillFolder] = useState(false)

  // Workspace folder (optional)
  const [workspacePath, setWorkspacePath] = useState('')
  const [workspacePathError, setWorkspacePathError] = useState<string | null>(null)
  const [isCheckingWorkspace, setIsCheckingWorkspace] = useState(false)
  const [workspaceVerified, setWorkspaceVerified] = useState(false)

  const handleSkillFolderPathChange = (value: string) => {
    setSkillFolderPath(value)
    setSkillFolderError(null)
    setSkillFolderVerified(false)
    setSkillFolderFiles([])
  }

  const handleAddSkillFolder = async () => {
    const trimmed = skillFolderPath.trim()
    if (!trimmed) return
    setIsCheckingSkillFolder(true)
    setSkillFolderError(null)
    setSkillFolderVerified(false)
    setSkillFolderFiles([])

    try {
      const res = await fetch(`/api/skill-folders/files?path=${encodeURIComponent(trimmed)}&mdOnly=true`)
      if (!res.ok) {
        const err = await res.json()
        setSkillFolderError(err.error ?? 'Directory not found')
        return
      }
      const { files } = await res.json() as { files: { name: string }[] }
      setSkillFolderFiles(files.map(f => f.name))
      setSkillFolderVerified(true)
    } catch {
      setSkillFolderError('Failed to check directory')
    } finally {
      setIsCheckingSkillFolder(false)
    }
  }

  const handleVerifyWorkspace = async () => {
    const trimmed = workspacePath.trim()
    if (!trimmed) return
    setIsCheckingWorkspace(true)
    setWorkspacePathError(null)
    setWorkspaceVerified(false)

    try {
      const res = await fetch(`/api/skill-folders/files?path=${encodeURIComponent(trimmed)}`)
      if (!res.ok) {
        const err = await res.json()
        setWorkspacePathError(err.error ?? 'Directory not found')
        return
      }
      setWorkspaceVerified(true)
    } catch {
      setWorkspacePathError('Failed to check directory')
    } finally {
      setIsCheckingWorkspace(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/sandboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          skillFolderPath: skillFolderPath.trim(),
          workspaceFolderPath: workspacePath.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Failed to create sandbox')
        return
      }
      const sandbox = await res.json()
      router.push(`/sandbox/${sandbox.id}`)
    } catch {
      setError('Failed to create sandbox')
    } finally {
      setIsCreating(false)
    }
  }

  const inputClass = 'flex-1 bg-parchment border rounded px-4 py-2.5 text-sm text-stone-900 placeholder-stone-300 focus:outline-none transition font-mono'

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-sepia px-8 py-4 flex justify-between items-center">
        <span className="font-display text-xl italic text-wine tracking-wide">Socratize</span>
      </header>

      <main className="max-w-xl mx-auto px-8 py-12">
        <button
          onClick={() => router.push('/sandbox')}
          className="text-sm text-stone-400 hover:text-stone-700 transition mb-8 block"
        >
          ← Back
        </button>

        <h1 className="font-display text-4xl font-normal text-stone-900 mb-10">New Sandbox</h1>

        <form onSubmit={handleCreate} className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">Sandbox name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. My research agent"
              className="w-full bg-parchment border border-sepia rounded px-4 py-2.5 text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">
              Skills folder <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                value={skillFolderPath}
                onChange={e => handleSkillFolderPathChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkillFolder() } }}
                placeholder="/absolute/path/to/your/skills"
                className={`${inputClass} ${skillFolderVerified ? 'border-wine/40 focus:border-wine/60' : 'border-sepia focus:border-stone-400'}`}
              />
              <button
                type="button"
                onClick={handleAddSkillFolder}
                disabled={!skillFolderPath.trim() || isCheckingSkillFolder}
                className="px-3 py-2 bg-vellum hover:bg-linen disabled:opacity-40 text-stone-600 text-sm rounded transition border border-sepia shrink-0"
              >
                {isCheckingSkillFolder ? '...' : 'Add'}
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-1">The folder where your skill files and feedback.md live.</p>

            {skillFolderError && <p className="text-xs text-wine mt-1">{skillFolderError}</p>}

            {skillFolderVerified && (
              <div className="mt-2 rounded border border-sepia overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-sepia bg-vellum">
                  <span className="text-xs text-stone-500 font-medium">
                    {skillFolderFiles.length === 0 ? 'Empty folder' : `${skillFolderFiles.length} .md file${skillFolderFiles.length !== 1 ? 's' : ''}`}
                  </span>
                  <span className="text-xs text-wine/60">✓ Found</span>
                </div>
                {skillFolderFiles.length > 0 && (
                  <div className="max-h-32 overflow-y-auto py-1 bg-parchment">
                    {skillFolderFiles.map(f => (
                      <div key={f} className="px-3 py-1 text-xs text-stone-400 font-mono hover:text-stone-600 transition">{f}</div>
                    ))}
                  </div>
                )}
                {skillFolderFiles.length === 0 && (
                  <div className="px-3 py-2 text-xs text-stone-400 italic bg-parchment">No .md files yet.</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">
              Workspace folder <span className="text-stone-400 font-normal">(optional — leave blank for a managed workspace)</span>
            </label>
            <div className="flex gap-2">
              <input
                value={workspacePath}
                onChange={e => { setWorkspacePath(e.target.value); setWorkspaceVerified(false); setWorkspacePathError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleVerifyWorkspace() } }}
                placeholder="/absolute/path/to/workspace"
                className={`${inputClass} ${workspaceVerified ? 'border-wine/40 focus:border-wine/60' : 'border-sepia focus:border-stone-400'}`}
              />
              <button
                type="button"
                onClick={handleVerifyWorkspace}
                disabled={!workspacePath.trim() || isCheckingWorkspace}
                className="px-3 py-2 bg-vellum hover:bg-linen disabled:opacity-40 text-stone-600 text-sm rounded transition border border-sepia shrink-0"
              >
                {isCheckingWorkspace ? '...' : 'Add'}
              </button>
            </div>
            {workspacePathError && <p className="text-xs text-wine mt-1">{workspacePathError}</p>}
            {workspaceVerified && <p className="text-xs text-wine/60 mt-1">✓ Found</p>}
          </div>

          {error && (
            <div className="text-wine text-sm bg-wine/5 border border-wine/20 rounded px-4 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={isCreating || !name.trim()}
            className="w-full bg-wine hover:bg-wine-hover disabled:opacity-40 text-parchment font-medium py-3 rounded transition"
          >
            {isCreating ? 'Creating...' : 'Create Sandbox →'}
          </button>
        </form>
      </main>
    </div>
  )
}
