'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChatPane } from './ChatPane'
import { EditorPane } from './EditorPane'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { applyDocOps, type DocOp } from '@/lib/doc-ops'

interface SessionViewProps {
  sessionId: string
  title: string
  initialMessages: ChatMessage[]
  initialMarkdown: string
}

export function SessionView({
  sessionId,
  title,
  initialMessages,
  initialMarkdown,
}: SessionViewProps) {
  const router = useRouter()
  const [markdown, setMarkdown] = useState(initialMarkdown)

  const handleDocOps = useCallback((ops: DocOp[]) => {
    setMarkdown(prev => applyDocOps(prev, ops))
  }, [])

  const { messages, streamingText, isStreaming, error, sendMessage } = useChat({
    sessionId,
    initialMessages,
    onDocOps: handleDocOps,
  })

  const handleMarkdownChange = useCallback(
    async (value: string) => {
      setMarkdown(value)
      await fetch(`/api/sessions/${sessionId}/document`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: value }),
      })
    },
    [sessionId]
  )

  const handleDownload = useCallback(() => {
    window.location.href = `/api/sessions/${sessionId}/export`
  }, [sessionId])

  const filename =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '.md'

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-300 text-sm transition"
          >
            ← Dashboard
          </button>
          <span className="text-sm text-gray-400">{title}</span>
        </div>
        <span className="text-lg font-bold text-red-500">Socratize</span>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 border-r border-gray-800 min-h-0">
          <ChatPane
            messages={messages}
            streamingText={streamingText}
            isStreaming={isStreaming}
            error={error}
            onSend={sendMessage}
          />
        </div>
        <div className="flex-1 min-h-0">
          <EditorPane
            filename={filename}
            content={markdown}
            onChange={handleMarkdownChange}
            onDownload={handleDownload}
          />
        </div>
      </div>
    </div>
  )
}
