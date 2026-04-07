'use client'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useDragResize } from '@/hooks/useDragResize'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { EditorView } from '@codemirror/view'
import { isBinaryFile, isUnsupportedPreviewFile } from '@/lib/file-types'
import { useSandboxChat, type SandboxMessage } from '@/hooks/useSandboxChat'
import { SandboxFileTree } from './SandboxFileTree'
import { SandboxChat } from './SandboxChat'
import { SandboxTerminal } from './SandboxTerminal'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

const EXTRACTABLE_EXTS = new Set(['.pdf', '.docx', '.pptx', '.xlsx'])

interface SandboxViewProps {
  sandboxId: string
  name: string
  initialMessages: SandboxMessage[]
  initialFiles: string[]
}

export function SandboxView({
  sandboxId,
  name,
  initialMessages,
  initialFiles,
}: SandboxViewProps) {
  const router = useRouter()
  const [files, setFiles] = useState<string[]>(initialFiles)
  const [activeFile, setActiveFile] = useState<{ filename: string; content: string } | null>(null)
  const activeFileRef = useRef(activeFile)
  useEffect(() => { activeFileRef.current = activeFile }, [activeFile])

  const [loadedSkills, setLoadedSkills] = useState<string[]>([])
  const [recentSkills, setRecentSkills] = useState<string[]>([])
  // All skills start enabled; user can toggle individually
  const [enabledSkills, setEnabledSkills] = useState<Set<string>>(new Set())

  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [activeQuote, setActiveQuote] = useState('')
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [isCommandRunning, setIsCommandRunning] = useState(false)

  const [fileTreeWidth, setFileTreeWidth] = useState(192)
  const [chatWidth, setChatWidth] = useState(384)
  const [terminalHeight, setTerminalHeight] = useState(280)
  const onFileTreeDrag = useCallback((delta: number) => {
    setFileTreeWidth(prev => Math.min(320, Math.max(120, prev + delta)))
  }, [])
  const onChatDrag = useCallback((delta: number) => {
    setChatWidth(prev => Math.min(600, Math.max(240, prev - delta)))
  }, [])
  const onTerminalDrag = useCallback((delta: number) => {
    setTerminalHeight(prev => Math.min(window.innerHeight * 0.6, Math.max(80, prev - delta)))
  }, [])

  const fileTreeDragHandle = useDragResize(onFileTreeDrag)
  const chatDragHandle = useDragResize(onChatDrag)
  const terminalDragHandle = useDragResize(onTerminalDrag, 'y')

  const handleFileUpdate = useCallback(({ filename, content }: { filename: string; content: string }) => {
    setActiveFile({ filename, content })
    setFiles(prev => prev.includes(filename) ? prev : [...prev, filename].sort())
  }, [])

  const handleCommandRun = useCallback(() => {
    setIsCommandRunning(true)
  }, [])

  const handleCommandComplete = useCallback(async () => {
    setIsCommandRunning(false)
    try {
      const res = await fetch(`/api/sandboxes/${sandboxId}/files`)
      if (!res.ok) return
      const { files: refreshed } = await res.json() as { files: string[] }
      setFiles(refreshed)
    } catch {
      // Silent failure — file tree will just not update
    }
  }, [sandboxId])

  const handleSkillsLoaded = useCallback((skills: string[]) => {
    setLoadedSkills(prev => {
      const merged = [...prev]
      for (const s of skills) {
        if (!merged.includes(s)) merged.push(s)
      }
      return merged.sort()
    })
    setRecentSkills(skills)
    // Enable newly loaded skills by default
    setEnabledSkills(prev => {
      const next = new Set(prev)
      for (const s of skills) next.add(s)
      return next
    })
  }, [])

  const {
    messages,
    streamingText,
    streamingToolCalls,
    isStreaming,
    error,
    initStatus,
    triggerInit,
    sendMessage,
    stopStreaming,
  } = useSandboxChat({
    sandboxId,
    initialMessages,
    onFileUpdate: handleFileUpdate,
    onSkillsLoaded: handleSkillsLoaded,
    onCommandRun: handleCommandRun,
    onCommandComplete: handleCommandComplete,
  })

  const hasAutoTriggered = useRef(false)
  useEffect(() => {
    if (hasAutoTriggered.current) return
    hasAutoTriggered.current = true
    if (initialMessages.length === 0) {
      triggerInit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileClick = useCallback(async (filename: string) => {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
    const companionName = `${filename}.txt`

    if (EXTRACTABLE_EXTS.has(ext) && !files.includes(companionName)) {
      try {
        const extractRes = await fetch(
          `/api/sandboxes/${sandboxId}/files/${encodeURIComponent(filename)}/extract`,
          { method: 'POST' }
        )
        if (extractRes.ok) {
          setFiles(prev => [...prev, companionName].sort())
        }
      } catch {
        // Silent failure — companion just won't appear
      }
    }

    try {
      const res = await fetch(`/api/sandboxes/${sandboxId}/files/${encodeURIComponent(filename)}`)
      if (!res.ok) return
      const { content } = await res.json() as { content: string }
      setActiveFile({ filename, content })
    } catch {
      // Silently ignore — file pane will just not update
    }
  }, [sandboxId, files])

  const handleFilesUploaded = useCallback((filenames: string[]) => {
    setFiles(prev => {
      const merged = [...prev]
      for (const f of filenames) {
        if (!merged.includes(f)) merged.push(f)
      }
      return merged.sort()
    })
  }, [])

  const handleFileChange = useCallback(async (value: string) => {
    const current = activeFileRef.current
    if (!current) return
    setActiveFile(prev => prev ? { ...prev, content: value } : null)
    try {
      await fetch(`/api/sandboxes/${sandboxId}/files/${encodeURIComponent(current.filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: value }),
      })
    } catch {
      // Silent failure — file save is best-effort
    }
  }, [sandboxId])

  const handleReInject = useCallback(() => {
    setRecentSkills([])
    triggerInit()
  }, [triggerInit])

  const handleSkillToggle = useCallback((skill: string) => {
    setEnabledSkills(prev => {
      const next = new Set(prev)
      if (next.has(skill)) next.delete(skill)
      else next.add(skill)
      return next
    })
  }, [])

  const handleSend = useCallback((content: string) => {
    sendMessage(content, {
      thinkingEnabled,
      enabledSkills: Array.from(enabledSkills),
    })
  }, [sendMessage, thinkingEnabled, enabledSkills])

  // Selection listener extension for CodeMirror
  const selectionExtension = useMemo(() => [
    EditorView.updateListener.of(update => {
      if (!update.selectionSet) return
      const sel = update.state.selection.main
      if (sel.empty) return // don't clear on deselect — user may have moved to chat
      const text = update.state.doc.sliceString(sel.from, sel.to)
      const filename = activeFileRef.current?.filename
      setActiveQuote(filename ? `[${filename}]\n${text}` : text)
    }),
  ], [])

  return (
    <div className="flex flex-col h-screen bg-parchment">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-parchment border-b border-sepia shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/sandbox')}
            className="text-stone-400 hover:text-stone-700 text-sm transition"
          >
            ← Sandbox
          </button>
          <span className="text-sm text-stone-400">{name}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTerminalOpen(v => !v)}
            title="Toggle terminal"
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border font-mono transition ${
              terminalOpen
                ? 'bg-stone-800 text-stone-300 border-stone-700'
                : 'text-stone-400 border-stone-600 hover:text-stone-600 hover:border-stone-300'
            }`}
          >
            <span>{'>_'}</span>
            {isCommandRunning && !terminalOpen && (
              <span className="text-wine animate-pulse text-[10px]">✦</span>
            )}
          </button>
          <span className="font-display text-xl italic text-wine">Socratize</span>
        </div>
      </div>

      {/* Three-pane IDE */}
      <div className="flex flex-1 min-h-0">
        {/* Left: file tree */}
        <div style={{ width: fileTreeWidth }} className="shrink-0 border-r border-sepia flex flex-col bg-vellum">
          <SandboxFileTree
            sandboxId={sandboxId}
            files={files}
            activeFilename={activeFile?.filename ?? null}
            onFileClick={handleFileClick}
            onFilesUploaded={handleFilesUploaded}
          />
        </div>

        <div
          onMouseDown={fileTreeDragHandle}
          className="w-1 shrink-0 bg-sepia hover:bg-stone-400 cursor-col-resize transition-colors select-none"
        />
        {/* Center: editor */}
        <div className="flex-1 min-w-0 border-r border-sepia flex flex-col min-h-0">
          <div className="px-4 py-2 bg-parchment border-b border-sepia text-xs text-stone-400 font-mono shrink-0 min-h-[40px] flex items-center">
            {activeFile?.filename ?? 'No file open'}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeFile ? (
              isBinaryFile(activeFile.filename) ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                  <p className="text-sm text-stone-400 font-medium">Preview not available</p>
                  <p className="text-xs text-stone-300 mt-1">Ask the agent to load this file.</p>
                </div>
              ) : isUnsupportedPreviewFile(activeFile.filename) ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                  <p className="text-sm text-stone-400 font-medium">Preview not available</p>
                  <p className="text-xs text-stone-300 mt-1">File not supported</p>
                </div>
              ) : (
                <CodeMirror
                  value={activeFile.content}
                  onChange={handleFileChange}
                  theme="light"
                  height="100%"
                  style={{ height: '100%' }}
                  extensions={selectionExtension}
                  basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-stone-400 text-sm">
                Click a file to open it
              </div>
            )}
          </div>
        </div>

        <div
          onMouseDown={chatDragHandle}
          className="w-1 shrink-0 bg-sepia hover:bg-stone-400 cursor-col-resize transition-colors select-none"
        />
        {/* Right: chat */}
        <div style={{ width: chatWidth }} className="shrink-0 flex flex-col min-h-0">
          <SandboxChat
            messages={messages}
            streamingText={streamingText}
            streamingToolCalls={streamingToolCalls}
            isStreaming={isStreaming}
            error={error}
            initStatus={initStatus}
            loadedSkills={loadedSkills}
            recentSkills={recentSkills}
            enabledSkills={enabledSkills}
            onSkillToggle={handleSkillToggle}
            thinkingEnabled={thinkingEnabled}
            onThinkingToggle={() => setThinkingEnabled(v => !v)}
            quotedText={activeQuote}
            onClearQuote={() => setActiveQuote('')}
            onSend={handleSend}
            onReInject={handleReInject}
            onStop={stopStreaming}
          />
        </div>
      </div>

      {/* Bottom: terminal panel */}
      {terminalOpen && (
        <div style={{ height: terminalHeight }} className="shrink-0 flex flex-col bg-[#1c1917] overflow-hidden">
          <div
            onMouseDown={terminalDragHandle}
            className="h-1 shrink-0 bg-stone-700 hover:bg-stone-500 cursor-row-resize transition-colors select-none"
          />
          <div className="flex items-center justify-between px-3 py-1 border-b border-stone-700 shrink-0">
            <span className="text-xs text-stone-400 font-mono">Terminal</span>
            <button
              onClick={() => setTerminalOpen(false)}
              className="text-stone-500 hover:text-stone-300 text-xs transition leading-none"
              aria-label="Close terminal"
            >
              ×
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <SandboxTerminal sandboxId={sandboxId} />
          </div>
        </div>
      )}
    </div>
  )
}
