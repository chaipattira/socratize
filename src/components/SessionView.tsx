'use client'
import { useState, useCallback, useEffect } from 'react'
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
  knowledgeFolderPath: string
  initialFiles: string[]
}

export function SessionView({
  sessionId,
  title,
  extractionMode,
  initialMessages,
  initialMarkdown,
  knowledgeFolderPath,
  initialFiles,
}: SessionViewProps) {
  const router = useRouter()
  const isKbSession = !!knowledgeFolderPath

  const [markdown, setMarkdown] = useState(initialMarkdown)
  const [isSocratizing, setIsSocratizing] = useState(false)

  // KB state
  const [files, setFiles] = useState<string[]>(initialFiles)
  const [activeFile, setActiveFile] = useState<{ filename: string; content: string } | null>(null)

  const handleDocOps = useCallback((ops: DocOp[]) => {
    setMarkdown(prev => applyDocOps(prev, ops))
  }, [])

  const handleSocratizeDone = useCallback(() => {
    setIsSocratizing(false)
  }, [])

  const handleFileUpdate = useCallback(({ filename, content }: { filename: string; content: string }) => {
    setActiveFile({ filename, content })
    setFiles(prev => prev.includes(filename) ? prev : [...prev, filename].sort())
  }, [])

  const handleFileClick = useCallback(async (filename: string) => {
    const res = await fetch(`/api/sessions/${sessionId}/file?filename=${encodeURIComponent(filename)}`)
    if (!res.ok) return
    const { content } = await res.json()
    setActiveFile({ filename, content })
  }, [sessionId])

  const { messages, streamingText, isStreaming, error, sendMessage, startSocratize, triggerSocratize, triggerKbSession } = useChat({
    sessionId,
    initialMessages,
    onDocOps: handleDocOps,
    onFileUpdate: handleFileUpdate,
    isSocratizing,
    onSocratizeDone: handleSocratizeDone,
  })

  useEffect(() => {
    if (isKbSession && initialMessages.length === 0) {
      triggerKbSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs once on mount

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
    triggerSocratize()
  }, [startSocratize, triggerSocratize])

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
          {!isKbSession && (
            <button
              onClick={handleSocratize}
              disabled={isStreaming || isSocratizing || !markdown.trim()}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition"
            >
              Socratize!
            </button>
          )}
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
            filename={isKbSession ? (activeFile?.filename ?? '') : filename}
            content={isKbSession ? (activeFile?.content ?? '') : markdown}
            onChange={isKbSession
              ? async (value: string) => {
                  if (!activeFile) return
                  setActiveFile(prev => prev ? { ...prev, content: value } : null)
                  await fetch(`/api/sessions/${sessionId}/file`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: activeFile.filename, content: value }),
                  })
                }
              : handleMarkdownChange
            }
            onDownload={handleDownload}
            files={isKbSession ? files : undefined}
            onFileClick={isKbSession ? handleFileClick : undefined}
            activeFilename={isKbSession ? activeFile?.filename : undefined}
          />
        </div>
      </div>
    </div>
  )
}
