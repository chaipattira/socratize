import { useState, useCallback } from 'react'
import { type DocOp } from '@/lib/doc-ops'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface UseChatOptions {
  sessionId: string
  initialMessages?: ChatMessage[]
  onDocOps: (ops: DocOp[]) => void
}

export function useChat({ sessionId, initialMessages = [], onDocOps }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return
      setError(null)
      setIsStreaming(true)

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }
      setMessages(prev => [...prev, userMsg])

      let assistantText = ''
      setStreamingText('')

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: content }),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error ?? 'Failed to send message')
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          // Process all complete SSE frames (each ends with \n\n)
          const frames = buffer.split('\n\n')
          buffer = frames.pop() ?? ''

          for (const frame of frames) {
            if (!frame.startsWith('data: ')) continue
            const event = JSON.parse(frame.slice(6))

            if (event.type === 'text') {
              assistantText += event.delta
              setStreamingText(assistantText)
            } else if (event.type === 'doc_ops') {
              onDocOps(event.ops)
            } else if (event.type === 'error') {
              throw new Error(event.message)
            } else if (event.type === 'done') {
              setMessages(prev => [
                ...prev,
                { id: crypto.randomUUID(), role: 'assistant', content: assistantText },
              ])
              setStreamingText('')
            }
          }
        }
      } catch (err) {
        setError(String(err))
        setMessages(prev => prev.slice(0, -1)) // Remove optimistic user message
      } finally {
        setIsStreaming(false)
      }
    },
    [sessionId, isStreaming, onDocOps]
  )

  return { messages, streamingText, isStreaming, error, sendMessage }
}
