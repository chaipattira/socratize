'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SandboxSummary {
  id: string
  name: string
  skillFolderPaths: string
  createdAt: string
  updatedAt: string
}

interface SandboxDashboardClientProps {
  initialSandboxes: SandboxSummary[]
}

export function SandboxDashboardClient({ initialSandboxes }: SandboxDashboardClientProps) {
  const router = useRouter()
  const [sandboxes, setSandboxes] = useState(initialSandboxes)

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/sandboxes/${id}`, { method: 'DELETE' })
    if (res.ok) setSandboxes(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <span className="text-xl font-bold text-red-500">Socratize</span>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Sessions
          </Link>
          <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Settings
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Sandbox</h1>
            <p className="text-gray-500 text-sm mt-1">AI agent workspaces with your skills</p>
          </div>
          <button
            onClick={() => router.push('/sandbox/new')}
            className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
          >
            + New Sandbox
          </button>
        </div>

        {sandboxes.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg mb-2">No sandboxes yet</p>
            <p className="text-sm">Create one to start working with your AI agent</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sandboxes.map(s => {
              let skillPaths: string[] = []
              try { skillPaths = JSON.parse(s.skillFolderPaths || '[]') } catch { /* malformed — treat as empty */ }
              const skillCount = skillPaths.length
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition"
                >
                  <button
                    onClick={() => router.push(`/sandbox/${s.id}`)}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium text-gray-100">{s.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {skillCount} skill folder{skillCount !== 1 ? 's' : ''} · Updated {new Date(s.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-gray-600 hover:text-red-400 transition text-sm ml-4"
                  >
                    Delete
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
