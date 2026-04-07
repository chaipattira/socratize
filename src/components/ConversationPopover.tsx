'use client'
import { useState, useRef, useEffect } from 'react'

export interface Conversation {
  id: string
  title: string
  createdAt: string
}

interface ConversationPopoverProps {
  conversations: Conversation[]
  activeConversationId: string
  onSelect: (id: string) => void
  onRename?: (id: string, title: string) => Promise<void>
  disabled?: boolean
}

export function ConversationPopover({
  conversations,
  activeConversationId,
  onSelect,
  onRename,
  disabled = false,
}: ConversationPopoverProps) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setEditingId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const active = conversations.find(c => c.id === activeConversationId)
  const label = active ? truncate(active.title, 22) : 'Conversations'

  const startEdit = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditValue(conv.title)
  }

  const confirmEdit = async (id: string) => {
    if (editValue.trim() && onRename) {
      await onRename(id, editValue.trim())
    }
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 border border-sepia hover:border-stone-400 px-2 py-0.5 rounded transition disabled:opacity-40"
        title="Switch conversation"
      >
        <span className="max-w-[140px] truncate">{label}</span>
        <span className="text-stone-300 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-parchment border border-sepia rounded shadow-md min-w-[200px] max-w-[280px] overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2 text-xs transition ${
                  conv.id === activeConversationId
                    ? 'bg-vellum text-stone-800 font-medium'
                    : 'text-stone-500 hover:bg-vellum hover:text-stone-800'
                }`}
              >
                {editingId === conv.id ? (
                  <>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') confirmEdit(conv.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      onBlur={() => confirmEdit(conv.id)}
                      className="flex-1 min-w-0 bg-transparent border-b border-stone-400 outline-none text-xs text-stone-800"
                    />
                    <button
                      onMouseDown={e => { e.preventDefault(); confirmEdit(conv.id) }}
                      className="text-stone-400 hover:text-wine transition shrink-0"
                      title="Confirm"
                    >✓</button>
                    <button
                      onMouseDown={e => { e.preventDefault(); cancelEdit() }}
                      className="text-stone-400 hover:text-stone-600 transition shrink-0"
                      title="Cancel"
                    >✗</button>
                  </>
                ) : (
                  <>
                    {conv.id === activeConversationId && (
                      <span className="w-1 h-1 rounded-full bg-wine shrink-0" />
                    )}
                    <button
                      onClick={() => { onSelect(conv.id); setOpen(false) }}
                      className={`flex-1 text-left truncate ${conv.id !== activeConversationId ? 'pl-3' : ''}`}
                    >
                      {conv.title}
                    </button>
                    {onRename && (
                      <button
                        onClick={e => startEdit(e, conv)}
                        className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-stone-600 transition shrink-0 text-[11px]"
                        title="Rename"
                      >✎</button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}
