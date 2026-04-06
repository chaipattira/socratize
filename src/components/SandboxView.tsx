'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useSandboxChat, type SandboxMessage } from '@/hooks/useSandboxChat'
import { SandboxFileTree } from './SandboxFileTree'
import { SandboxChat } from './SandboxChat'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

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
  const [loadedSkills, setLoadedSkills] = useState<string[]>([])
  const [recentSkills, setRecentSkills] = useState<string[]>([])

  const handleFileUpdate = useCallback(({ filename, content }: { filename: string; content: string }) => {
    setActiveFile({ filename, content })
    setFiles(prev => prev.includes(filename) ? prev : [...prev, filename].sort())
  }, [])

  const handleSkillsLoaded = useCallback((skills: string[]) => {
    setLoadedSkills(prev => {
      const merged = [...prev]
      for (const s of skills) {
        if (!merged.includes(s)) merged.push(s)
      }
      return merged.sort()
    })
    setRecentSkills(skills)
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
  } = useSandboxChat({
    sandboxId,
    initialMessages,
    onFileUpdate: handleFileUpdate,
    onSkillsLoaded: handleSkillsLoaded,
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
    const res = await fetch(`/api/sandboxes/${sandboxId}/files/${encodeURIComponent(filename)}`)
    if (!res.ok) return
    const { content } = await res.json()
    setActiveFile({ filename, content })
  }, [sandboxId])

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
    if (!activeFile) return
    setActiveFile(prev => prev ? { ...prev, content: value } : null)
    await fetch(`/api/sandboxes/${sandboxId}/files/${encodeURIComponent(activeFile.filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: value }),
    })
  }, [sandboxId, activeFile])

  const handleReInject = useCallback(() => {
    setRecentSkills([])
    triggerInit()
  }, [triggerInit])

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/sandbox')}
            className="text-gray-500 hover:text-gray-300 text-sm transition"
          >
            ← Sandbox
          </button>
          <span className="text-sm text-gray-400">{name}</span>
        </div>
        <span className="text-lg font-bold text-red-500">Socratize</span>
      </div>

      {/* Three-pane IDE */}
      <div className="flex flex-1 min-h-0">
        {/* Left: file tree */}
        <div className="w-48 shrink-0 border-r border-gray-800 flex flex-col bg-gray-950">
          <SandboxFileTree
            sandboxId={sandboxId}
            files={files}
            activeFilename={activeFile?.filename ?? null}
            onFileClick={handleFileClick}
            onFilesUploaded={handleFilesUploaded}
          />
        </div>

        {/* Center: editor */}
        <div className="flex-1 min-w-0 border-r border-gray-800 flex flex-col">
          <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500 shrink-0">
            <span className="font-mono">{activeFile?.filename ?? 'No file open'}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            {activeFile ? (
              <CodeMirror
                value={activeFile.content}
                onChange={handleFileChange}
                theme="dark"
                height="100%"
                basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                Click a file to open it
              </div>
            )}
          </div>
        </div>

        {/* Right: chat */}
        <div className="w-96 shrink-0 flex flex-col min-h-0">
          <SandboxChat
            messages={messages}
            streamingText={streamingText}
            streamingToolCalls={streamingToolCalls}
            isStreaming={isStreaming}
            error={error}
            initStatus={initStatus}
            loadedSkills={loadedSkills}
            recentSkills={recentSkills}
            onSend={sendMessage}
            onReInject={handleReInject}
          />
        </div>
      </div>
    </div>
  )
}
