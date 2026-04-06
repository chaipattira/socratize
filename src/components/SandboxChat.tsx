'use client'
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, keymap } from '@codemirror/view'
import { insertNewlineAndIndent } from '@codemirror/commands'
import type { SandboxMessage } from '@/hooks/useSandboxChat'
import { ToolCallRow } from './ToolCallRow'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

interface SandboxChatProps {
  messages: SandboxMessage[]
  streamingText: string
  streamingToolCalls: Array<{ name: string; input: Record<string, unknown>; done: boolean }>
  isStreaming: boolean
  error: string | null
  initStatus: 'idle' | 'loading' | 'done' | 'error'
  loadedSkills: string[]
  recentSkills: string[]
  onSend: (message: string) => void
  onReInject: () => void
}


export function SandboxChat({
  messages,
  streamingText,
  streamingToolCalls,
  isStreaming,
  error,
  initStatus,
  loadedSkills,
  recentSkills,
  onSend,
  onReInject,
}: SandboxChatProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const submitRef = useRef<() => void>(() => {})

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, streamingToolCalls])

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isStreaming) return
    onSend(input.trim())
    setInput('')
  }, [input, isStreaming, onSend])

  useEffect(() => {
    submitRef.current = handleSubmit
  }, [handleSubmit])

  const extensions = useMemo(() => [
    markdown(),
    EditorView.lineWrapping,
    EditorView.theme({
      '&': { minHeight: '42px', maxHeight: '200px' },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-content': { minHeight: '42px', padding: '10px 14px' },
      '.cm-line': { padding: '0' },
    }),
    keymap.of([
      { key: 'Shift-Enter', run: insertNewlineAndIndent },
      { key: 'Enter', run: () => { submitRef.current(); return true } },
    ]),
  ], [])

  const skillsBadgeNode = useMemo(() => {
    if (initStatus === 'idle') return null
    if (initStatus === 'loading') {
      return <span className="text-xs text-gray-500 animate-pulse">Loading skills...</span>
    }
    if (initStatus === 'error') {
      return (
        <span className="flex items-center gap-2">
          <span className="text-xs text-red-400">Skills not loaded</span>
          <button onClick={onReInject} className="text-xs text-red-400 underline hover:text-red-300">retry</button>
        </span>
      )
    }
    if (loadedSkills.length === 0) {
      return <span className="text-xs text-gray-600">No skills configured</span>
    }
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {loadedSkills.map(skill => (
          <span
            key={skill}
            className={`text-xs px-1.5 py-0.5 rounded font-mono transition ${
              recentSkills.includes(skill)
                ? 'bg-green-900/60 text-green-300 border border-green-700'
                : 'bg-gray-800 text-gray-500 border border-gray-700'
            }`}
          >
            {skill}
          </span>
        ))}
      </div>
    )
  }, [initStatus, loadedSkills, recentSkills, onReInject])

  return (
    <div className="flex flex-col h-full">
      {/* Header: skills badge + re-inject */}
      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between gap-2 min-h-[40px]">
        <div className="flex-1 min-w-0">{skillsBadgeNode}</div>
        {initStatus === 'done' && (
          <button
            onClick={onReInject}
            disabled={isStreaming}
            className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 transition shrink-0"
            title="Re-inject skills"
          >
            ↺ Re-inject
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              msg.role === 'assistant' ? 'bg-green-700' : 'bg-blue-700'
            }`}>
              {msg.role === 'assistant' ? 'A' : 'P'}
            </div>
            <div className="max-w-[85%] flex flex-col gap-0.5">
              {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mb-1">
                  {msg.toolCalls.map((tc, i) => (
                    <ToolCallRow key={i} name={tc.name} input={tc.input} done={tc.done} />
                  ))}
                </div>
              )}
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? msg.isInit
                    ? 'bg-green-950 border border-green-800 rounded-tl-sm'
                    : 'bg-gray-800 rounded-tl-sm'
                  : 'bg-gray-700 rounded-tr-sm'
              }`}>
                <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-p:leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}

        {(streamingText || streamingToolCalls.length > 0) && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-green-700">A</div>
            <div className="max-w-[85%] flex flex-col gap-0.5">
              {streamingToolCalls.length > 0 && (
                <div className="mb-1">
                  {streamingToolCalls.map((tc, i) => (
                    <ToolCallRow key={i} name={tc.name} input={tc.input} done={tc.done} />
                  ))}
                </div>
              )}
              {streamingText && (
                <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-gray-800 text-sm leading-relaxed">
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-p:leading-relaxed">
                    <ReactMarkdown>{streamingText}</ReactMarkdown>
                  </div>
                  <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-middle" />
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex gap-2 items-end">
          <div className="flex-1 rounded-lg overflow-hidden border border-gray-700 focus-within:border-gray-500 bg-gray-900 text-sm">
            <CodeMirror
              value={input}
              onChange={setInput}
              placeholder={isStreaming ? 'Waiting for response...' : 'Ask the agent...'}
              theme="dark"
              extensions={extensions}
              basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, indentOnInput: false }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={isStreaming || !input.trim()}
            className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
