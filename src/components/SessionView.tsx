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
  extractionMode: 'guided' | 'direct'
  initialMessages: ChatMessage[]
  initialMarkdown: string
}

export function SessionView({
  sessionId,
  title,
  extractionMode,
  initialMessages,
  initialMarkdown,
}: SessionViewProps) {
  const router = useRouter()
  const [markdown, setMarkdown] = useState(initialMarkdown)
  const [isSocratizing, setIsSocratizing] = useState(false)

  const handleDocOps = useCallback((ops: DocOp[]) => {
    setMarkdown(prev => applyDocOps(prev, ops))
  }, [])

  const handleSocratizeDone = useCallback(() => {
    setIsSocratizing(false)
  }, [])

  const { messages, streamingText, isStreaming, error, sendMessage, startSocratize } = useChat({
    sessionId,
    initialMessages,
    onDocOps: handleDocOps,
    isSocratizing,
    onSocratizeDone: handleSocratizeDone,
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

  const handleSocratize = useCallback(() => {
    startSocratize()
    setIsSocratizing(true)
    // Trigger the first socratize call with no follow-ups — Claude reviews the doc and responds
    sendMessage('\u200B') // zero-width space as trigger; the socratize endpoint ignores user message content
  }, [startSocratize, sendMessage])

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
        <div className="flex items-center gap-3">
          <button
            onClick={handleSocratize}
            disabled={isStreaming || isSocratizing || !markdown.trim()}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition"
          >
            Socratize!
          </button>
          <span className="text-lg font-bold text-red-500">Socratize</span>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 border-r border-gray-800 min-h-0">
          <ChatPane
            messages={messages}
            streamingText={streamingText}
            isStreaming={isStreaming}
            error={error}
            isSocratizing={isSocratizing}
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
