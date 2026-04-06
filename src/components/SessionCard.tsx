'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface SessionCardProps {
  id: string
  title: string
  updatedAt: string
  messageCount: number
  llmProvider: string
  model: string
  extractionMode: string
  onDelete: (id: string) => void
}

export function SessionCard({
  id,
  title,
  updatedAt,
  messageCount,
  llmProvider,
  model,
  extractionMode,
  onDelete,
}: SessionCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${title}"?`)) return
    setDeleting(true)
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    onDelete(id)
  }

  return (
    <div
      onClick={() => router.push(`/sessions/${id}`)}
      className="py-4 cursor-pointer hover:bg-vellum -mx-4 px-4 rounded transition group"
    >
      <div className="flex justify-between items-baseline">
        <h3 className="font-display text-lg font-normal text-stone-900 group-hover:text-wine transition">{title}</h3>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-stone-300 hover:text-wine transition text-xs opacity-0 group-hover:opacity-100"
        >
          Delete
        </button>
      </div>
      <div className="mt-0.5 flex items-center gap-3 text-xs text-stone-400">
        <span>{messageCount} messages</span>
        <span>·</span>
        <span className="capitalize">{llmProvider}</span>
        <span>·</span>
        <span>{new Date(updatedAt).toLocaleDateString()}</span>
        {extractionMode === 'socratize' && (
          <>
            <span>·</span>
            <span className="text-wine/60">skill</span>
          </>
        )}
      </div>
    </div>
  )
}
