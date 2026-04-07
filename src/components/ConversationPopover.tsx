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
  onNew: () => void
  disabled?: boolean
}

export function ConversationPopover({
  conversations,
  activeConversationId,
  onSelect,
  onNew,
  disabled = false,
}: ConversationPopoverProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const active = conversations.find(c => c.id === activeConversationId)
  const label = active ? truncate(active.title, 22) : 'Conversations'

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
          <button
            onClick={() => { onNew(); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-xs text-wine hover:bg-wine/5 border-b border-sepia transition font-medium"
          >
            + New conversation
          </button>
          <div className="max-h-48 overflow-y-auto">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => { onSelect(conv.id); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs transition flex items-center gap-2 ${
                  conv.id === activeConversationId
                    ? 'bg-vellum text-stone-800 font-medium'
                    : 'text-stone-500 hover:bg-vellum hover:text-stone-800'
                }`}
              >
                {conv.id === activeConversationId && (
                  <span className="w-1 h-1 rounded-full bg-wine shrink-0" />
                )}
                <span className={`truncate ${conv.id !== activeConversationId ? 'pl-3' : ''}`}>
                  {conv.title}
                </span>
              </button>
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
