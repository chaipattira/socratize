'use client'
import { useRef, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ChatMessage, ToolCallItem } from '@/hooks/useChat'
import { supportsThinking } from '@/lib/thinking-models'

interface ChatPaneProps {
  messages: ChatMessage[]
  streamingText: string
  streamingThinking: string
  streamingToolCalls: ToolCallItem[]
  isStreaming: boolean
  error: string | null
  isSocratizing: boolean
  onSend: (message: string) => void
  provider: string
  model: string
  thinkingEnabled: boolean
  onThinkingToggle: () => void
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
  isSocratizing,
  onSend,
  provider,
  model,
  thinkingEnabled,
  onThinkingToggle,
}: ChatPaneProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, streamingThinking, streamingToolCalls])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isSocratizing ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 font-medium">Socratize mode</span>
            </>
          ) : (
            'Conversation'
          )}
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
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                msg.role === 'assistant'
                  ? msg.isSocratize
                    ? 'bg-orange-600'
                    : 'bg-red-600'
                  : 'bg-blue-700'
              }`}
            >
              {msg.role === 'assistant' ? 'S' : 'P'}
            </div>
            <div className="max-w-[85%] flex flex-col gap-0.5">
              {/* Thinking block */}
              {msg.role === 'assistant' && msg.thinking && (
                <ThinkingBlockView text={msg.thinking.text} />
              )}
              {/* Tool call rows */}
              {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mb-1">
                  {msg.toolCalls.map((tc, i) => (
                    <ToolCallRow key={i} name={tc.name} input={tc.input} done={tc.done} />
                  ))}
                </div>
              )}
              {/* Message bubble */}
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'bg-gray-800 rounded-tl-sm'
                    : 'bg-gray-700 rounded-tr-sm'
                }`}
              >
                <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-p:leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}

        {(streamingText || streamingThinking || streamingToolCalls.length > 0) && (
          <div className="flex gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isSocratizing ? 'bg-orange-600' : 'bg-red-600'
              }`}
            >
              S
            </div>
            <div className="max-w-[85%] flex flex-col gap-0.5">
              {/* Streaming thinking */}
              {streamingThinking && (
                <ThinkingBlockView text={streamingThinking} isStreaming={!streamingText && streamingToolCalls.every(tc => tc.done)} />
              )}
              {/* Streaming tool calls */}
              {streamingToolCalls.length > 0 && (
                <div className="mb-1">
                  {streamingToolCalls.map((tc, i) => (
                    <ToolCallRow key={i} name={tc.name} input={tc.input} done={tc.done} />
                  ))}
                </div>
              )}
              {/* Streaming text */}
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

      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder={
              isStreaming
                ? 'Waiting for response...'
                : isSocratizing
                ? 'Answer the question above...'
                : 'Share your expertise...'
            }
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
