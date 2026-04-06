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
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-700 transition group"
    >
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-gray-100 group-hover:text-white transition">{title}</h3>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-gray-600 hover:text-red-400 transition text-xs"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
        <span>{messageCount} messages</span>
        <span>·</span>
        <span className="capitalize">{llmProvider}</span>
        <span>·</span>
        <span>{new Date(updatedAt).toLocaleDateString()}</span>
        {extractionMode === 'socratize' && (
          <>
            <span>·</span>
            <span className="text-amber-600">skill</span>
          </>
        )}
      </div>
    </div>
  )
}
