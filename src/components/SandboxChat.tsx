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
import { ConversationPopover } from './ConversationPopover'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

const mdComponents = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-vellum">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-1.5 text-left font-semibold text-stone-700 border border-sepia">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-1.5 text-stone-600 border border-sepia">{children}</td>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="even:bg-vellum/50 hover:bg-vellum">{children}</tr>
  ),
}

function ThinkingBlockView({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition"
      >
        <span className="text-wine/50">✦</span>
        <span className="italic">Thought for a moment</span>
        <span className="text-stone-300">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="mt-1.5 pl-3 border-l border-sepia text-xs text-stone-400 leading-relaxed font-mono whitespace-pre-wrap max-h-64 overflow-y-auto italic">
          {text}
        </div>
      )}
    </div>
  )
}

function SkillsDropdown({
  loadedSkills,
  recentSkills,
  enabledSkills,
  onSkillToggle,
  onReInject,
  initStatus,
}: {
  loadedSkills: string[]
  recentSkills: string[]
  enabledSkills: Set<string>
  onSkillToggle: (skill: string) => void
  onReInject: () => void
  initStatus: 'idle' | 'loading' | 'done' | 'error'
}) {
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

  if (initStatus === 'idle') return null
  if (initStatus === 'loading') {
    return <span className="text-xs text-stone-400 italic animate-pulse">Loading skills...</span>
  }
  if (initStatus === 'error') {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs text-wine">Skills not loaded</span>
        <button onClick={onReInject} className="text-xs text-wine underline hover:text-wine-hover">retry</button>
      </span>
    )
  }
  if (loadedSkills.length === 0) {
    return <span className="text-xs text-stone-400 italic">No skills</span>
  }

  const enabledCount = loadedSkills.filter(s => enabledSkills.has(s)).length

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 border border-sepia hover:border-stone-400 px-2 py-0.5 rounded transition"
        title="Manage skills"
      >
        <span>Skills ({enabledCount}/{loadedSkills.length})</span>
        <span className="text-stone-300 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-parchment border border-sepia rounded shadow-md min-w-[180px] max-w-[260px] max-h-64 overflow-y-auto">
          {loadedSkills.map(skill => {
            const isEnabled = enabledSkills.has(skill)
            const isRecent = recentSkills.includes(skill)
            return (
              <button
                key={skill}
                onClick={() => onSkillToggle(skill)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-vellum transition"
                title={isEnabled ? 'Click to disable' : 'Click to enable'}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isEnabled ? 'bg-wine' : 'bg-stone-200'}`} />
                <span className={`font-mono truncate ${
                  isEnabled
                    ? isRecent ? 'text-wine' : 'text-stone-700'
                    : 'text-stone-300 line-through'
                }`}>
                  {skill}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface MessageRatingProps {
  messageId: string
  messages: SandboxMessage[]
  messageIndex: number
  skillFolderPath: string
  onRate: (messageId: string, rating: 'up' | 'down', comment: string, promptExcerpt: string, responseExcerpt: string) => void
}

function MessageRating({ messageId, messages, messageIndex, skillFolderPath, onRate }: MessageRatingProps) {
  const [selected, setSelected] = useState<'up' | 'down' | null>(null)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (!selected) return
    const precedingUser = [...messages].slice(0, messageIndex).reverse().find(m => m.role === 'user')
    const currentMsg = messages[messageIndex]
    onRate(
      messageId,
      selected,
      comment,
      precedingUser?.content.slice(0, 200) ?? '',
      currentMsg?.content.slice(0, 200) ?? '',
    )
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
        Feedback saved —{' '}
        {skillFolderPath
          ? <>start a new Interview with <code className="font-mono text-stone-500 bg-linen px-1 rounded text-[10px]">{skillFolderPath}</code> to incorporate the changes</>
          : 'start a new Interview to incorporate the changes'
        }
      </p>
    )
  }

  return (
    <div className="mt-1.5 flex items-start gap-1.5">
      {selected === null ? (
        <>
          <button
            onClick={() => setSelected('up')}
            className="text-stone-300 hover:text-stone-500 text-xs transition leading-none"
            title="This was helpful"
          >
            👍
          </button>
          <button
            onClick={() => setSelected('down')}
            className="text-stone-300 hover:text-stone-500 text-xs transition leading-none"
            title="This could be improved"
          >
            👎
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs leading-none">{selected === 'up' ? '👍' : '👎'}</span>
            <input
              autoFocus
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') setSelected(null) }}
              placeholder="Optional comment..."
              className="text-xs border border-sepia rounded px-2 py-1 bg-parchment text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition w-44"
            />
          </div>
          <div className="flex items-center gap-2 pl-5">
            <button
              onClick={handleSubmit}
              className="text-xs text-wine hover:text-wine-hover transition"
            >
              Submit
            </button>
            <button
              onClick={() => { setSelected(null); setComment('') }}
              className="text-xs text-stone-300 hover:text-stone-500 transition"
            >
              Cancel
            </button>
          </div>
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
  onStop: () => void
  onRate: (messageId: string, rating: 'up' | 'down', comment: string, promptExcerpt: string, responseExcerpt: string) => void
  skillFolderPath: string
  conversations: Array<{ id: string; title: string; createdAt: string }>
  activeConversationId: string
  onConversationSelect: (id: string) => void
  onNewConversation: () => void
  onRenameConversation: (id: string, title: string) => Promise<void>
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
  onStop,
  onRate,
  skillFolderPath,
  conversations,
  activeConversationId,
  onConversationSelect,
  onNewConversation,
  onRenameConversation,
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
      '&': { minHeight: '42px', maxHeight: '200px', background: '#FAF8F4' },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-content': { minHeight: '42px', padding: '10px 14px', color: '#1c1917', caretColor: '#7C2D35' },
      '.cm-line': { padding: '0' },
      '.cm-focused': { outline: 'none' },
    }),
    keymap.of([
      { key: 'Shift-Enter', run: insertNewlineAndIndent },
      { key: 'Enter', run: () => { submitRef.current(); return true } },
    ]),
  ], [])

  return (
    <div className="flex flex-col h-full bg-parchment">
      {/* Header: conversation switcher + skills + thinking toggle */}
      <div className="px-4 py-2 bg-parchment border-b border-sepia flex items-center justify-between gap-2 min-h-[40px]">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <button
            onClick={onNewConversation}
            disabled={isStreaming}
            title="New conversation"
            className="w-5 h-5 flex items-center justify-center rounded-full border border-sepia text-stone-400 hover:text-wine hover:border-wine/40 text-xs transition disabled:opacity-40 shrink-0"
          >
            +
          </button>
          <ConversationPopover
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelect={onConversationSelect}
            onRename={onRenameConversation}
            disabled={isStreaming}
          />
          <SkillsDropdown
            loadedSkills={loadedSkills}
            recentSkills={recentSkills}
            enabledSkills={enabledSkills}
            onSkillToggle={onSkillToggle}
            onReInject={onReInject}
            initStatus={initStatus}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onThinkingToggle}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition border ${
              thinkingEnabled
                ? 'bg-wine/10 text-wine border-wine/30'
                : 'text-stone-400 border-sepia hover:text-stone-600 hover:border-stone-300'
            }`}
            title="Toggle extended thinking"
          >
            <span className="text-[10px]">✦</span>
            <span>Thinking</span>
            <span className={thinkingEnabled ? 'text-wine/70' : 'text-stone-300'}>
              {thinkingEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
          {initStatus === 'done' && (
            <button
              onClick={onReInject}
              disabled={isStreaming}
              className="text-xs text-stone-400 hover:text-wine disabled:opacity-40 transition"
              title="Re-inject skills"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.map((msg, index) => (
          <div key={msg.id} className={`${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
            <div className={`text-[10px] uppercase tracking-widest mb-1 ${
              msg.role === 'assistant' ? 'text-wine/50' : 'text-stone-300'
            }`}>
              {msg.role === 'assistant' ? 'Agent' : 'You'}
            </div>
            <div className={`max-w-[88%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : ''}`}>
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
              <div className={`px-4 py-3 rounded-lg text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? msg.isInit
                    ? 'bg-wine/5 border-l-2 border-wine/20 text-stone-800'
                    : 'bg-vellum border-l-2 border-sepia text-stone-800'
                  : 'bg-linen text-stone-800'
              }`}>
                <div className="prose prose-sm prose-stone max-w-none prose-p:my-0 prose-p:leading-relaxed prose-table:w-full">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
            {msg.role === 'assistant' && !msg.isInit && !isStreaming && (
              <div className="max-w-[88%]">
                <MessageRating
                  messageId={msg.id}
                  messages={messages}
                  messageIndex={index}
                  skillFolderPath={skillFolderPath}
                  onRate={onRate}
                />
              </div>
            )}
          </div>
        ))}

        {(streamingText || streamingToolCalls.length > 0) && (
          <div>
            <div className="text-[10px] uppercase tracking-widest mb-1 text-wine/50">Agent</div>
            <div className="max-w-[88%] flex flex-col gap-1">
              {streamingToolCalls.length > 0 && (
                <div className="mb-1">
                  {streamingToolCalls.map((tc, i) => (
                    <ToolCallRow key={i} name={tc.name} input={tc.input} done={tc.done} />
                  ))}
                </div>
              )}
              {streamingText && (
                <div className="px-4 py-3 rounded-lg bg-vellum border-l-2 border-sepia text-sm leading-relaxed text-stone-800">
                  <div className="prose prose-sm prose-stone max-w-none prose-p:my-0 prose-p:leading-relaxed prose-table:w-full">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
                      {streamingText}
                    </ReactMarkdown>
                  </div>
                  <span className="inline-block w-0.5 h-3.5 bg-wine/50 ml-0.5 animate-pulse align-middle" />
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="text-wine text-sm bg-wine/5 border border-wine/20 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        {messages.length >= 20 && (
          <div className="text-xs text-stone-400 bg-wine/5 border border-wine/20 rounded px-3 py-2 text-center">
            This conversation is getting long. For best results, consider starting a fresh one.
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-sepia">
        {quotedText && (() => {
          const fileMatch = quotedText.match(/^\[(.+?)\]\n/)
          const quoteFile = fileMatch ? fileMatch[1] : null
          const quoteBody = fileMatch ? quotedText.slice(fileMatch[0].length) : quotedText
          return (
            <div className="mb-2 flex items-start gap-2 px-3 py-2 bg-vellum border border-sepia rounded text-xs text-stone-500">
              <span className="shrink-0 text-stone-300">›</span>
              <span className="flex-1 min-w-0">
                {quoteFile && <span className="font-mono text-stone-400 bg-linen px-1 py-0.5 rounded text-[11px] mr-1.5">{quoteFile}</span>}
                <span className="line-clamp-1 leading-relaxed italic">
                  {quoteBody.length > 100 ? `${quoteBody.slice(0, 100)}…` : quoteBody}
                </span>
              </span>
              <button
                onClick={onClearQuote}
                className="shrink-0 text-stone-300 hover:text-stone-600 transition"
                aria-label="Clear quote"
              >
                ×
              </button>
            </div>
          )
        })()}
        <div className="flex gap-2 items-end">
          <div className="flex-1 rounded-lg overflow-hidden border border-sepia focus-within:border-stone-400 bg-parchment text-sm transition">
            <CodeMirror
              value={input}
              onChange={setInput}
              placeholder={isStreaming ? 'Waiting for response...' : 'Ask the agent...'}
              theme="light"
              extensions={extensions}
              basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, indentOnInput: false }}
            />
          </div>
          {isStreaming ? (
            <button
              onClick={onStop}
              title="Stop"
              aria-label="Stop streaming"
              className="bg-stone-700 hover:bg-stone-800 text-parchment px-3 py-2.5 rounded text-sm font-medium transition shrink-0"
            >
              ■
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="bg-wine hover:bg-wine-hover disabled:opacity-40 text-parchment px-4 py-2.5 rounded text-sm font-medium transition shrink-0"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
