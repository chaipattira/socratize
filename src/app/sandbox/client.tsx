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
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-sepia px-8 py-4 flex justify-between items-center">
        <span className="font-display text-xl italic text-wine tracking-wide">Socratize</span>
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm text-stone-500 hover:text-stone-800 transition">
            Sessions
          </Link>
          <Link href="/settings" className="text-sm text-stone-500 hover:text-stone-800 transition">
            Settings
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-12">
        <div className="flex justify-between items-baseline mb-10">
          <div>
            <h1 className="font-display text-4xl font-normal text-stone-900">Sandbox</h1>
            <p className="text-stone-400 text-sm mt-1">AI agent workspaces with your skills</p>
          </div>
          <button
            onClick={() => router.push('/sandbox/new')}
            className="bg-wine hover:bg-wine-hover text-parchment text-sm font-medium px-5 py-2 rounded transition"
          >
            New Sandbox
          </button>
        </div>

        {sandboxes.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-display text-2xl text-stone-300 italic">No sandboxes yet</p>
            <p className="text-stone-400 text-sm mt-2">Create one to start working with your AI agent</p>
          </div>
        ) : (
          <div className="divide-y divide-sepia">
            {sandboxes.map(s => {
              let skillPaths: string[] = []
              try { skillPaths = JSON.parse(s.skillFolderPaths || '[]') } catch { /* malformed — treat as empty */ }
              const skillCount = skillPaths.length
              return (
                <div
                  key={s.id}
                  className="py-4 hover:bg-vellum -mx-4 px-4 rounded transition group flex items-center justify-between"
                >
                  <button
                    onClick={() => router.push(`/sandbox/${s.id}`)}
                    className="flex-1 text-left"
                  >
                    <div className="font-display text-lg font-normal text-stone-900 group-hover:text-wine transition">{s.name}</div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      {skillCount} skill folder{skillCount !== 1 ? 's' : ''} · Updated {new Date(s.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-stone-300 hover:text-wine transition text-xs ml-4 opacity-0 group-hover:opacity-100"
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
