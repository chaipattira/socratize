'use client'
import { useRef, useEffect, useState } from 'react'
import type { ChatMessage } from '@/hooks/useChat'

interface ChatPaneProps {
  messages: ChatMessage[]
  streamingText: string
  isStreaming: boolean
  error: string | null
  onSend: (message: string) => void
}

export function ChatPane({ messages, streamingText, isStreaming, error, onSend }: ChatPaneProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500">
        Conversation
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                msg.role === 'assistant' ? 'bg-red-600' : 'bg-blue-700'
              }`}
            >
              {msg.role === 'assistant' ? 'S' : 'P'}
            </div>
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? 'bg-gray-800 rounded-tl-sm'
                  : 'bg-gray-700 rounded-tr-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold shrink-0">
              S
            </div>
            <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-sm bg-gray-800 text-sm leading-relaxed">
              {streamingText}
              <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-middle" />
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
            placeholder={isStreaming ? 'Waiting for response...' : 'Share your expertise...'}
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
