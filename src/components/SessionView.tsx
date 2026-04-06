'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChatPane } from './ChatPane'
import { EditorPane } from './EditorPane'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { applyDocOps, type DocOp } from '@/lib/doc-ops'

interface SessionViewProps {
  sessionId: string
  title: string
  extractionMode: 'guided' | 'direct' | 'socratize'
  initialMessages: ChatMessage[]
  initialMarkdown: string
  knowledgeFolderPath: string
  initialFiles: string[]
  llmProvider: string
  model: string
}

export function SessionView({
  sessionId,
  title,
  extractionMode,
  initialMessages,
  initialMarkdown,
  knowledgeFolderPath,
  initialFiles,
  llmProvider,
  model,
}: SessionViewProps) {
  const router = useRouter()
  const isKbSession = !!knowledgeFolderPath

  const [markdown, setMarkdown] = useState(initialMarkdown)
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [activeQuote, setActiveQuote] = useState('')

  // KB state
  const [files, setFiles] = useState<string[]>(initialFiles)
  const [activeFile, setActiveFile] = useState<{ filename: string; content: string } | null>(null)

  // Phase is fixed for the lifetime of the session — derived from extractionMode
  const phase = extractionMode === 'socratize' ? 'building' as const : null

  const handleDocOps = useCallback((ops: DocOp[]) => {
    setMarkdown(prev => applyDocOps(prev, ops))
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

  const handleSelectionChange = useCallback((text: string) => {
    if (text) {
      const prefix = activeFile?.filename ? `[${activeFile.filename}]\n` : ''
      setActiveQuote(prefix + text)
    }
  }, [activeFile?.filename])

  const handleClearQuote = useCallback(() => {
    setActiveQuote('')
  }, [])

  const {
    messages,
    streamingText,
    streamingThinking,
    streamingToolCalls,
    isStreaming,
    error,
    sendMessage,
    triggerBuildPhase,
    triggerKbSession,
  } = useChat({
    sessionId,
    initialMessages,
    onDocOps: handleDocOps,
    onFileUpdate: handleFileUpdate,
    phase,
    thinkingEnabled,
  })

  const hasAutoTriggered = useRef(false)

  useEffect(() => {
    if (hasAutoTriggered.current) return
    hasAutoTriggered.current = true
    if (extractionMode === 'socratize' && initialMessages.length === 0) {
      triggerBuildPhase()
    } else if (isKbSession && initialMessages.length === 0) {
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

  const filename =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '.md'

  return (
    <div className="flex flex-col h-screen bg-parchment">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-parchment border-b border-sepia shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-stone-400 hover:text-stone-700 text-sm transition"
          >
            ← Dashboard
          </button>
          <span className="text-sm text-stone-400">{title}</span>
        </div>
        <span className="font-display text-xl italic text-wine">Socratize</span>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 border-r border-sepia min-h-0 min-w-0 overflow-hidden">
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
            onSelectionChange={handleSelectionChange}
          />
        </div>
        <div className="flex-1 min-h-0">
          <ChatPane
            messages={messages}
            streamingText={streamingText}
            streamingThinking={streamingThinking}
            streamingToolCalls={streamingToolCalls}
            isStreaming={isStreaming}
            error={error}
            phase={phase}
            onSend={sendMessage}
            provider={llmProvider}
            model={model}
            thinkingEnabled={thinkingEnabled}
            onThinkingToggle={() => setThinkingEnabled(v => !v)}
            quotedText={activeQuote}
            onClearQuote={handleClearQuote}
          />
        </div>
      </div>
    </div>
  )
}
