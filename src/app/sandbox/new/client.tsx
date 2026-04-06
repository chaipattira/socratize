'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SkillFolder {
  id: string
  title: string
  path: string
  mdFiles: string[]
}

export function NewSandboxClient() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Skill folders
  const [customPath, setCustomPath] = useState('')
  const [addedFolders, setAddedFolders] = useState<SkillFolder[]>([])
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [customPathError, setCustomPathError] = useState<string | null>(null)
  const [isCheckingPath, setIsCheckingPath] = useState(false)

  // Workspace folder (optional)
  const [workspacePath, setWorkspacePath] = useState('')
  const [workspacePathError, setWorkspacePathError] = useState<string | null>(null)
  const [isCheckingWorkspace, setIsCheckingWorkspace] = useState(false)
  const [workspaceVerified, setWorkspaceVerified] = useState(false)

  const toggleFolder = (path: string) => {
    setSelectedPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    )
  }

  const handleAddCustomPath = async () => {
    const trimmed = customPath.trim()
    if (!trimmed) return
    if (addedFolders.some(f => f.path === trimmed)) {
      setCustomPathError('This folder is already in the list')
      return
    }

    setIsCheckingPath(true)
    setCustomPathError(null)

    try {
      const res = await fetch(`/api/skill-folders/files?path=${encodeURIComponent(trimmed)}`)
      if (!res.ok) {
        const err = await res.json()
        setCustomPathError(err.error ?? 'Directory not found')
        return
      }
      const { files } = await res.json() as { files: { name: string }[] }
      const newFolder: SkillFolder = {
        id: `added-${Date.now()}`,
        title: trimmed.split('/').pop() ?? trimmed,
        path: trimmed,
        mdFiles: files.map(f => f.name),
      }
      setAddedFolders(prev => [...prev, newFolder])
      setSelectedPaths(prev => [...prev, trimmed])
      setCustomPath('')
    } catch {
      setCustomPathError('Failed to check directory')
    } finally {
      setIsCheckingPath(false)
    }
  }

  const handleVerifyWorkspace = async () => {
    const trimmed = workspacePath.trim()
    if (!trimmed) return
    setIsCheckingWorkspace(true)
    setWorkspacePathError(null)
    setWorkspaceVerified(false)

    try {
      // Reuse the skill-folders API just to check if the path exists and is a directory
      const res = await fetch(`/api/skill-folders/files?path=${encodeURIComponent(trimmed)}`)
      if (!res.ok) {
        const err = await res.json()
        setWorkspacePathError(err.error ?? 'Directory not found')
        return
      }
      setWorkspaceVerified(true)
    } catch {
      setWorkspacePathError('Failed to verify directory')
    } finally {
      setIsCheckingWorkspace(false)
    }
  }

  const handleLaunch = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setIsCreating(true)
    setError(null)

    const body: Record<string, unknown> = {
      name: name.trim(),
      skillFolderPaths: selectedPaths,
    }
    const trimmedWorkspace = workspacePath.trim()
    if (trimmedWorkspace) {
      body.workspaceFolderPath = trimmedWorkspace
    }

    const createRes = await fetch('/api/sandboxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!createRes.ok) {
      const err = await createRes.json()
      setError(err.error ?? 'Failed to create sandbox')
      setIsCreating(false)
      return
    }

    const sandbox = await createRes.json()
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
            <p className="text-xs text-gray-500 mb-3">
              Paths to folders containing .md skill files the agent can use.
            </p>

            {addedFolders.length > 0 && (
              <div className="space-y-2 mb-3">
                {addedFolders.map(folder => {
                  const selected = selectedPaths.includes(folder.path)
                  return (
                    <div key={folder.id}>
                      <button
                        onClick={() => toggleFolder(folder.path)}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                          selected
                            ? 'border-green-600 bg-green-950 text-green-300'
                            : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base">{selected ? '✓' : '○'}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{folder.title}</div>
                            <div className="text-xs text-gray-600 font-mono mt-0.5 truncate">{folder.path}</div>
                          </div>
                        </div>
                      </button>
                      {selected && folder.mdFiles.length > 0 && (
                        <div className="ml-4 mt-1 pl-3 border-l border-gray-700 space-y-0.5">
                          {folder.mdFiles.map(f => (
                            <div key={f} className="text-xs text-gray-500 font-mono py-0.5">{f}</div>
                          ))}
                        </div>
                      )}
                      {selected && folder.mdFiles.length === 0 && (
                        <div className="ml-4 mt-1 pl-3 border-l border-gray-700">
                          <div className="text-xs text-gray-600 italic py-0.5">No .md files found</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={customPath}
                onChange={e => { setCustomPath(e.target.value); setCustomPathError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCustomPath() }}
                placeholder="/path/to/skills/folder"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 font-mono"
              />
              <button
                onClick={handleAddCustomPath}
                disabled={!customPath.trim() || isCheckingPath}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm rounded-lg transition border border-gray-700"
              >
                {isCheckingPath ? '...' : 'Add'}
              </button>
            </div>
            {customPathError && (
              <p className="text-xs text-red-400 mt-1">{customPathError}</p>
            )}
          </div>

          {/* Workspace folder */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Workspace Folder <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Point to an existing folder on disk — the agent will read and write files there directly.
              Leave blank to use a managed workspace (you can upload files later).
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={workspacePath}
                onChange={e => {
                  setWorkspacePath(e.target.value)
                  setWorkspacePathError(null)
                  setWorkspaceVerified(false)
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleVerifyWorkspace() }}
                placeholder="/path/to/your/project"
                className={`flex-1 bg-gray-900 border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none font-mono transition ${
                  workspaceVerified ? 'border-green-700 focus:border-green-500' : 'border-gray-700 focus:border-gray-500'
                }`}
              />
              <button
                onClick={handleVerifyWorkspace}
                disabled={!workspacePath.trim() || isCheckingWorkspace}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm rounded-lg transition border border-gray-700"
              >
                {isCheckingWorkspace ? '...' : 'Verify'}
              </button>
            </div>
            {workspacePathError && (
              <p className="text-xs text-red-400 mt-1">{workspacePathError}</p>
            )}
            {workspaceVerified && (
              <p className="text-xs text-green-500 mt-1">✓ Folder found</p>
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
