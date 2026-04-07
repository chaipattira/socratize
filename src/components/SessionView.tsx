'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChatPane } from './ChatPane'
import { EditorPane } from './EditorPane'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { applyDocOps, type DocOp } from '@/lib/doc-ops'
import { useDragResize } from '@/hooks/useDragResize'

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
  initialConversations: Array<{ id: string; title: string; createdAt: string }>
  initialConversationId: string
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
  initialConversations,
  initialConversationId,
}: SessionViewProps) {
  const router = useRouter()
  const isKbSession = !!knowledgeFolderPath

  const [markdown, setMarkdown] = useState(initialMarkdown)
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [activeQuote, setActiveQuote] = useState('')
  const [editorPct, setEditorPct] = useState(50)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  const onEditorDrag = useCallback((delta: number) => {
    if (!splitContainerRef.current) return
    const total = splitContainerRef.current.clientWidth
    setEditorPct(prev => Math.min(80, Math.max(20, prev + (delta / total) * 100)))
  }, [])
  const editorDragHandle = useDragResize(onEditorDrag)

  // KB state
  const [files, setFiles] = useState<string[]>(initialFiles)
  const [activeFile, setActiveFile] = useState<{ filename: string; content: string } | null>(null)

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

  // Conversations state
  const [conversations, setConversations] = useState(initialConversations)
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId)
  const [activeConversationMessages, setActiveConversationMessages] = useState<ChatMessage[]>(initialMessages)

  const handleNewConversation = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/conversations`, { method: 'POST' })
      if (!res.ok) return
      const { conversation } = await res.json() as { conversation: { id: string; title: string; createdAt: string } }
      setConversations(prev => [...prev, conversation])
      setActiveConversationMessages([])
      setActiveConversationId(conversation.id)
    } catch {
      // silent
    }
  }, [sessionId])

  const handleConversationSelect = useCallback(async (convId: string) => {
    if (convId === activeConversationId) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/conversations`)
      if (!res.ok) return
      const { conversations: all } = await res.json() as { conversations: Array<{ id: string; title: string; createdAt: string }> }
      setConversations(all)
    } catch {
      // continue with existing list
    }
    setActiveConversationMessages([])
    setActiveConversationId(convId)
  }, [sessionId, activeConversationId])

  const handleRenameConversation = useCallback(async (convId: string, title: string) => {
    const prevConvs = conversations
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, title } : c))
    try {
      await fetch(`/api/sessions/${sessionId}/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
    } catch {
      // revert on error
      setConversations(prevConvs)
    }
  }, [sessionId, conversations])

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
      <div ref={splitContainerRef} className="flex flex-1 min-h-0">
        <div style={{ width: `${editorPct}%` }} className="min-h-0 min-w-0 overflow-hidden shrink-0">
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
        <div
          onMouseDown={editorDragHandle}
          className="w-1 shrink-0 bg-sepia hover:bg-stone-400 cursor-col-resize transition-colors select-none"
        />
        <div className="flex-1 min-h-0 min-w-0">
          <SessionChatWrapper
            key={activeConversationId}
            sessionId={sessionId}
            conversationId={activeConversationId}
            initialMessages={activeConversationMessages}
            extractionMode={extractionMode}
            knowledgeFolderPath={knowledgeFolderPath}
            llmProvider={llmProvider}
            model={model}
            conversations={conversations}
            onConversationSelect={handleConversationSelect}
            onNewConversation={handleNewConversation}
            onRenameConversation={handleRenameConversation}
            onDocOps={handleDocOps}
            onFileUpdate={isKbSession ? handleFileUpdate : undefined}
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

interface SessionChatWrapperProps {
  sessionId: string
  conversationId: string
  initialMessages: ChatMessage[]
  extractionMode: 'guided' | 'direct' | 'socratize'
  knowledgeFolderPath: string
  llmProvider: string
  model: string
  conversations: Array<{ id: string; title: string; createdAt: string }>
  onConversationSelect: (id: string) => void
  onNewConversation: () => void
  onRenameConversation: (convId: string, title: string) => Promise<void>
  onDocOps: (ops: DocOp[]) => void
  onFileUpdate?: (update: { filename: string; content: string }) => void
  thinkingEnabled: boolean
  onThinkingToggle: () => void
  quotedText?: string
  onClearQuote?: () => void
}

function SessionChatWrapper({
  sessionId,
  conversationId,
  initialMessages,
  extractionMode,
  knowledgeFolderPath,
  llmProvider,
  model,
  conversations,
  onConversationSelect,
  onNewConversation,
  onRenameConversation,
  onDocOps,
  onFileUpdate,
  thinkingEnabled,
  onThinkingToggle,
  quotedText,
  onClearQuote,
}: SessionChatWrapperProps) {
  const phase = extractionMode === 'socratize' ? 'building' as const : null
  const isKbSession = !!knowledgeFolderPath

  const { messages, streamingText, streamingThinking, streamingToolCalls, isStreaming, error, sendMessage, triggerBuildPhase, triggerKbSession } = useChat({
    sessionId,
    conversationId,
    initialMessages,
    onDocOps,
    onFileUpdate,
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
  }, [])

  return (
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
      onThinkingToggle={onThinkingToggle}
      quotedText={quotedText}
      onClearQuote={onClearQuote}
      conversations={conversations}
      activeConversationId={conversationId}
      onConversationSelect={onConversationSelect}
      onNewConversation={onNewConversation}
      onRenameConversation={onRenameConversation}
    />
  )
}
