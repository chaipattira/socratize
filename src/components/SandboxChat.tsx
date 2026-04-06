'use client'
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, keymap } from '@codemirror/view'
import { insertNewlineAndIndent } from '@codemirror/commands'
import type { SandboxMessage } from '@/hooks/useSandboxChat'
import { ToolCallRow } from './ToolCallRow'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

const mdComponents = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-gray-700">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-1.5 text-left font-semibold text-gray-200 border border-gray-600">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-1.5 text-gray-300 border border-gray-600">{children}</td>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="even:bg-gray-750 hover:bg-gray-700/50">{children}</tr>
  ),
}

function ThinkingBlockView({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-400 transition"
      >
        <span>✦</span>
        <span>Thought for a moment</span>
        <span className="text-gray-600">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="mt-1.5 pl-3 border-l border-gray-700 text-xs text-gray-500 leading-relaxed font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  )
}

interface SandboxChatProps {
  messages: SandboxMessage[]
  streamingText: string
  streamingToolCalls: Array<{ name: string; input: Record<string, unknown>; done: boolean }>
  isStreaming: boolean
  error: string | null
  initStatus: 'idle' | 'loading' | 'done' | 'error'
  loadedSkills: string[]
  recentSkills: string[]
  enabledSkills: Set<string>
  onSkillToggle: (skill: string) => void
  thinkingEnabled: boolean
  onThinkingToggle: () => void
  quotedText: string
  onClearQuote: () => void
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
  enabledSkills,
  onSkillToggle,
  thinkingEnabled,
  onThinkingToggle,
  quotedText,
  onClearQuote,
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
    const body = quotedText
      ? `> ${quotedText.trim().split('\n').join('\n> ')}\n\n${input.trim()}`
      : input.trim()
    onSend(body)
    setInput('')
    onClearQuote()
  }, [input, isStreaming, onSend, quotedText, onClearQuote])

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

  const skillsSection = useMemo(() => {
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
        {loadedSkills.map(skill => {
          const isEnabled = enabledSkills.has(skill)
          const isRecent = recentSkills.includes(skill)
          return (
            <button
              key={skill}
              onClick={() => onSkillToggle(skill)}
              title={isEnabled ? 'Click to disable this skill' : 'Click to enable this skill'}
              className={`text-xs px-1.5 py-0.5 rounded font-mono transition ${
                !isEnabled
                  ? 'bg-gray-900 text-gray-600 border border-gray-800 line-through opacity-50'
                  : isRecent
                  ? 'bg-green-900/60 text-green-300 border border-green-700'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
              }`}
            >
              {skill}
            </button>
          )
        })}
      </div>
    )
  }, [initStatus, loadedSkills, recentSkills, enabledSkills, onSkillToggle, onReInject])

  return (
    <div className="flex flex-col h-full">
      {/* Header: skills + re-inject + thinking toggle */}
      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between gap-2 min-h-[40px]">
        <div className="flex-1 min-w-0">{skillsSection}</div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onThinkingToggle}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition border ${
              thinkingEnabled
                ? 'bg-purple-900/60 text-purple-300 border-purple-700'
                : 'text-gray-500 border-gray-700 hover:text-gray-300 hover:border-gray-600'
            }`}
            title="Toggle extended thinking"
          >
            <span>✦</span>
            <span>{thinkingEnabled ? 'ON' : 'OFF'}</span>
          </button>
          {initStatus === 'done' && (
            <button
              onClick={onReInject}
              disabled={isStreaming}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 transition"
              title="Re-inject skills"
            >
              ↺
            </button>
          )}
        </div>
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
              {msg.role === 'assistant' && msg.thinking && (
                <ThinkingBlockView text={msg.thinking} />
              )}
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
                <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-p:leading-relaxed prose-table:w-full">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
                    {msg.content}
                  </ReactMarkdown>
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
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-p:leading-relaxed prose-table:w-full">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
                      {streamingText}
                    </ReactMarkdown>
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
        {quotedText && (() => {
          const fileMatch = quotedText.match(/^\[(.+?)\]\n/)
          const quoteFile = fileMatch ? fileMatch[1] : null
          const quoteBody = fileMatch ? quotedText.slice(fileMatch[0].length) : quotedText
          return (
            <div className="mb-2 flex items-start gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400">
              <span className="shrink-0 text-gray-600">›</span>
              <span className="flex-1 min-w-0">
                {quoteFile && <span className="font-mono text-gray-500 bg-gray-700 px-1 py-0.5 rounded text-[11px] mr-1.5">{quoteFile}</span>}
                <span className="line-clamp-1 leading-relaxed">
                  {quoteBody.length > 100 ? `${quoteBody.slice(0, 100)}…` : quoteBody}
                </span>
              </span>
              <button
                onClick={onClearQuote}
                className="shrink-0 text-gray-600 hover:text-gray-300 transition"
                aria-label="Clear quote"
              >
                ×
              </button>
            </div>
          )
        })()}
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
