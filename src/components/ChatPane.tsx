'use client'
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, keymap } from '@codemirror/view'
import { insertNewlineAndIndent } from '@codemirror/commands'
import type { ChatMessage, ToolCallItem } from '@/hooks/useChat'
import { supportsThinking } from '@/lib/thinking-models'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

interface ChatPaneProps {
  messages: ChatMessage[]
  streamingText: string
  streamingThinking: string
  streamingToolCalls: ToolCallItem[]
  isStreaming: boolean
  error: string | null
  phase: 'building' | 'testing' | null
  onSend: (message: string) => void
  provider: string
  model: string
  thinkingEnabled: boolean
  onThinkingToggle: () => void
  selectedSkillFile?: string
  quotedText?: string
  onClearQuote?: () => void
}

function ThinkingBlockView({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-400 transition"
      >
        <span className={isStreaming ? 'animate-pulse' : ''}>✦</span>
        <span>{isStreaming ? 'Thinking...' : 'Thought for a moment'}</span>
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

function ToolCallRow({ name, input, done }: { name: string; input: Record<string, unknown>; done: boolean }) {
  const label = input.filename ? String(input.filename) : input.section ? String(input.section) : ''
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 py-0.5">
      {done ? (
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
      )}
      <span className="font-medium text-gray-400 capitalize">{name.replace(/_/g, ' ')}</span>
      {label && <span className="text-gray-600 truncate max-w-[200px]">{label}</span>}
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
  selectedSkillFile,
  quotedText,
  onClearQuote,
}: ChatPaneProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const submitRef = useRef<() => void>(() => {})

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, streamingThinking, streamingToolCalls])

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isStreaming) return
    if (phase === 'testing' && !selectedSkillFile) return
    const body = quotedText
      ? `> ${quotedText.split('\n').join('\n> ')}\n\n${input.trim()}`
      : input.trim()
    onSend(body)
    setInput('')
    onClearQuote?.()
  }, [input, isStreaming, phase, selectedSkillFile, onSend, quotedText, onClearQuote])

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

  const lastRole = messages.length > 0 ? messages[messages.length - 1].role : null

  const avatarClass =
    phase === 'building' ? 'bg-amber-600' :
    phase === 'testing' ? 'bg-blue-600' :
    'bg-red-600'

  const headerContent = () => {
    if (phase === 'building') return (
      <>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-amber-400 font-medium">Building skill</span>
      </>
    )
    if (phase === 'testing') return (
      <>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-blue-400 font-medium">
          {selectedSkillFile ? `Testing: ${selectedSkillFile}` : 'Select a skill from the sidebar'}
        </span>
      </>
    )
    return <span>Conversation</span>
  }

  const getPlaceholder = () => {
    if (isStreaming) return 'Waiting for response...'
    if (phase === 'testing' && !selectedSkillFile) return 'Select a skill file from the sidebar first...'
    if (phase === 'building') return 'Answer the question above...'
    if (phase === 'testing') return lastRole === 'assistant'
      ? 'Give your feedback...'
      : 'Send a test prompt as an end user would...'
    return 'Share your expertise...'
  }

  const sendDisabled = isStreaming || !input.trim() || (phase === 'testing' && !selectedSkillFile)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {headerContent()}
        </div>
        {supportsThinking(provider, model) && (
          <button
            onClick={onThinkingToggle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
              thinkingEnabled
                ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                : 'text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-600'
            }`}
          >
            <span>✦</span>
            <span>Thinking</span>
            <span className={thinkingEnabled ? 'text-purple-400' : 'text-gray-600'}>
              {thinkingEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              msg.role === 'assistant' ? avatarClass : 'bg-blue-700'
            }`}>
              {msg.role === 'assistant' ? 'S' : 'P'}
            </div>
            <div className="max-w-[85%] flex flex-col gap-0.5">
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
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'assistant' ? 'bg-gray-800 rounded-tl-sm' : 'bg-gray-700 rounded-tr-sm'
              }`}>
                <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-p:leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}

        {(streamingText || streamingThinking || streamingToolCalls.length > 0) && (
          <div className="flex gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass}`}>
              S
            </div>
            <div className="max-w-[85%] flex flex-col gap-0.5">
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

      <div className="p-3 border-t border-gray-800">
        {quotedText && (
          <div className="mb-2 flex items-start gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400">
            <span className="shrink-0 text-gray-600">›</span>
            <span className="flex-1 line-clamp-2 leading-relaxed">
              {quotedText.length > 120 ? `${quotedText.slice(0, 120)}…` : quotedText}
            </span>
            <button
              onClick={onClearQuote}
              className="shrink-0 text-gray-600 hover:text-gray-300 transition"
              aria-label="Clear quote"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 rounded-lg overflow-hidden border border-gray-700 focus-within:border-gray-500 bg-gray-900 text-sm">
            <CodeMirror
              value={input}
              onChange={setInput}
              placeholder={getPlaceholder()}
              theme="dark"
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
            className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
