'use client'
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, keymap } from '@codemirror/view'
import { insertNewlineAndIndent } from '@codemirror/commands'
import type { ChatMessage, ToolCallItem } from '@/hooks/useChat'
import { supportsThinking } from '@/lib/thinking-models'
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

interface ChatPaneProps {
  messages: ChatMessage[]
  streamingText: string
  streamingThinking: string
  streamingToolCalls: ToolCallItem[]
  isStreaming: boolean
  error: string | null
  phase: 'building' | null
  onSend: (message: string) => void
  provider: string
  model: string
  thinkingEnabled: boolean
  onThinkingToggle: () => void
  quotedText?: string
  onClearQuote?: () => void
  conversations: Array<{ id: string; title: string; createdAt: string }>
  activeConversationId: string
  onConversationSelect: (id: string) => void
  onNewConversation: () => void
  onRenameConversation: (id: string, title: string) => Promise<void>
}

function ThinkingBlockView({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition"
      >
        <span className={`text-wine/50 ${isStreaming ? 'animate-pulse' : ''}`}>✦</span>
        <span className="italic">{isStreaming ? 'Thinking...' : 'Thought for a moment'}</span>
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


export function ChatPane({
  messages,
  streamingText,
  streamingThinking,
  streamingToolCalls,
  isStreaming,
  error,
  phase,
  onSend,
  provider,
  model,
  thinkingEnabled,
  onThinkingToggle,
  quotedText,
  onClearQuote,
  conversations,
  activeConversationId,
  onConversationSelect,
  onNewConversation,
  onRenameConversation,
}: ChatPaneProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const submitRef = useRef<() => void>(() => {})

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, streamingThinking, streamingToolCalls])

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isStreaming) return
    const body = quotedText
      ? `> ${quotedText.trim().split('\n').join('\n> ')}\n\n${input.trim()}`
      : input.trim()
    onSend(body)
    setInput('')
    onClearQuote?.()
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
      '.cm-content': { minHeight: '42px', padding: '10px 14px', color: '#1c1917', caretColor: '#8B1A24' },
      '.cm-line': { padding: '0' },
      '.cm-focused': { outline: 'none' },
    }),
    keymap.of([
      { key: 'Shift-Enter', run: insertNewlineAndIndent },
      { key: 'Enter', run: () => { submitRef.current(); return true } },
    ]),
  ], [])

  const lastRole = messages.length > 0 ? messages[messages.length - 1].role : null

  const headerContent = () => {
    if (phase === 'building') return (
      <>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-amber-700 font-medium">Building skill</span>
      </>
    )
    return <span className="text-stone-400">Conversation</span>
  }

  const getPlaceholder = () => {
    if (isStreaming) return 'Waiting for response...'
    if (phase === 'building') return 'Answer the question above...'
    return 'Share your expertise...'
  }

  const sendDisabled = isStreaming || !input.trim()

  return (
    <div className="flex flex-col h-full bg-parchment">
      <div className="px-4 py-2 bg-vellum border-b border-sepia text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
          {headerContent()}
        </div>
        {supportsThinking(provider, model) && (
          <button
            onClick={onThinkingToggle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              thinkingEnabled
                ? 'bg-wine/10 text-wine border border-wine/30'
                : 'text-stone-400 hover:text-stone-600 border border-sepia hover:border-stone-300'
            }`}
          >
            <span className="text-[10px]">✦</span>
            <span>Thinking</span>
            <span className={thinkingEnabled ? 'text-wine/70' : 'text-stone-300'}>
              {thinkingEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.map(msg => (
          <div key={msg.id} className={`${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
            <div className={`text-[10px] uppercase tracking-widest mb-1 ${
              msg.role === 'assistant' ? 'text-wine/50' : 'text-stone-300'
            }`}>
              {msg.role === 'assistant' ? 'Socrates' : 'You'}
            </div>
            <div className={`max-w-[88%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : ''}`}>
              {msg.role === 'assistant' && msg.thinking && (
                <ThinkingBlockView text={msg.thinking.text} />
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
                  ? 'bg-vellum border-l-2 border-sepia text-stone-800'
                  : 'bg-linen text-stone-800'
              }`}>
                <div className="prose prose-sm prose-stone max-w-none prose-p:my-0 prose-p:leading-relaxed prose-table:w-full">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}

        {(streamingText || streamingThinking || streamingToolCalls.length > 0) && (
          <div>
            <div className="text-[10px] uppercase tracking-widest mb-1 text-wine/50">Socrates</div>
            <div className="max-w-[88%] flex flex-col gap-1">
              {streamingThinking && (
                <ThinkingBlockView text={streamingThinking} isStreaming={!streamingText && streamingToolCalls.every(tc => tc.done)} />
              )}
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>{streamingText}</ReactMarkdown>
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
              placeholder={getPlaceholder()}
              theme="light"
              extensions={extensions}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                indentOnInput: false,
              }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={sendDisabled}
            className="bg-wine hover:bg-wine-hover disabled:opacity-40 text-parchment px-4 py-2.5 rounded text-sm font-medium transition shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
