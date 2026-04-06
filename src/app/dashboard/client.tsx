'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionCard } from '@/components/SessionCard'
import Link from 'next/link'

interface SessionSummary {
  id: string
  title: string
  llmProvider: string
  model: string
  extractionMode: string
  updatedAt: string
  _count: { messages: number }
}

interface DashboardClientProps {
  initialSessions: SessionSummary[]
}

export function DashboardClient({ initialSessions }: DashboardClientProps) {
  const router = useRouter()
  const [sessions, setSessions] = useState(initialSessions)

  const handleDelete = (id: string) => setSessions(prev => prev.filter(s => s.id !== id))

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-sepia px-8 py-4 flex justify-between items-center">
        <span className="font-display text-xl italic text-wine tracking-wide">Socratize</span>
        <div className="flex items-center gap-6">
          <Link href="/sandbox" className="text-sm text-stone-500 hover:text-stone-800 transition">Sandbox</Link>
          <Link href="/settings" className="text-sm text-stone-500 hover:text-stone-800 transition">Settings</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-12">
        <div className="flex justify-between items-baseline mb-10">
          <div>
            <h1 className="font-display text-4xl font-normal text-stone-900">Sessions</h1>
            <p className="text-stone-400 text-sm mt-1">Your knowledge extraction sessions</p>
          </div>
          <button
            onClick={() => router.push('/sessions/new')}
            className="bg-wine hover:bg-wine-hover text-parchment text-sm font-medium px-5 py-2 rounded transition"
          >
            New Session
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-display text-2xl text-stone-300 italic">No sessions yet</p>
            <p className="text-stone-400 text-sm mt-2">Begin extracting your expertise</p>
          </div>
        ) : (
          <div className="divide-y divide-sepia">
            {sessions.map(s => (
              <SessionCard
                key={s.id}
                id={s.id}
                title={s.title}
                updatedAt={s.updatedAt}
                messageCount={s._count.messages}
                llmProvider={s.llmProvider}
                model={s.model}
                extractionMode={s.extractionMode}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
