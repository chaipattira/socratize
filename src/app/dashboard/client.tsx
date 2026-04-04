'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionCard } from '@/components/SessionCard'
import { NewSessionDialog } from '@/components/NewSessionDialog'
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
  const [showDialog, setShowDialog] = useState(false)

  const handleDelete = (id: string) => setSessions(prev => prev.filter(s => s.id !== id))

  const handleTestSkill = async (
    sourceSessionId: string,
    title: string,
    llmProvider: string,
    model: string
  ) => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        llmProvider,
        model,
        extractionMode: 'socratize_eval',
        sourceSessionId,
      }),
    })
    if (!res.ok) return
    const session = await res.json()
    router.push(`/sessions/${session.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <span className="text-xl font-bold text-red-500">Socratize</span>
        <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-200 transition">Settings</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Sessions</h1>
            <p className="text-gray-500 text-sm mt-1">Your knowledge extraction sessions</p>
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
          >
            + New Session
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg mb-2">No sessions yet</p>
            <p className="text-sm">Start one to begin extracting your expertise</p>
          </div>
        ) : (
          <div className="space-y-3">
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
                onTestSkill={handleTestSkill}
              />
            ))}
          </div>
        )}
      </main>

      {showDialog && <NewSessionDialog onClose={() => setShowDialog(false)} />}
    </div>
  )
}
