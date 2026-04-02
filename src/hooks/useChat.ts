import { useState, useCallback, useRef } from 'react'
import { type DocOp } from '@/lib/doc-ops'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isSocratize?: boolean
}

interface UseChatOptions {
  sessionId: string
  initialMessages?: ChatMessage[]
  onDocOps: (ops: DocOp[]) => void
  onFileUpdate?: (update: { filename: string; content: string }) => void
  isSocratizing: boolean
  onSocratizeDone: () => void
}

export function useChat({
  sessionId,
  initialMessages = [],
  onDocOps,
  onFileUpdate,
  isSocratizing,
  onSocratizeDone,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks socratize follow-up messages (assistant questions + user answers)
  const socratizeFollowUps = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return
      setError(null)
      setIsStreaming(true)

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        isSocratize: isSocratizing,
      }
      setMessages(prev => [...prev, userMsg])

      let assistantText = ''
      setStreamingText('')

      try {
        let response: Response

        if (isSocratizing) {
          // Add the user's answer to the follow-ups before sending
          socratizeFollowUps.current.push({ role: 'user', content })

          response = await fetch(`/api/sessions/${sessionId}/socratize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ followUps: socratizeFollowUps.current }),
          })
        } else {
          response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message: content }),
          })
        }

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error ?? 'Failed to send message')
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let gotDocOps = false

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
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
              gotDocOps = true
            } else if (event.type === 'file_update') {
              onFileUpdate?.({ filename: event.filename, content: event.content })
            } else if (event.type === 'error') {
              throw new Error(event.message)
            } else if (event.type === 'done') {
              const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: assistantText,
                isSocratize: isSocratizing,
              }
              setMessages(prev => [...prev, assistantMsg])
              setStreamingText('')

              if (isSocratizing) {
                // Track assistant's reply in follow-ups
                socratizeFollowUps.current.push({ role: 'assistant', content: assistantText })
                // If Claude wrote doc ops, the SKILL.md is done — exit socratize mode
                if (gotDocOps) {
                  socratizeFollowUps.current = []
                  onSocratizeDone()
                }
              }
            }
          }
        }
      } catch (err) {
        setError(String(err))
        setMessages(prev => prev.slice(0, -1))
        if (isSocratizing) {
          // Roll back the follow-up we just added
          socratizeFollowUps.current = socratizeFollowUps.current.slice(0, -1)
        }
      } finally {
        setIsStreaming(false)
      }
    },
    [sessionId, isStreaming, onDocOps, isSocratizing, onSocratizeDone]
  )

  const startSocratize = useCallback(() => {
    socratizeFollowUps.current = []
  }, [])

  const triggerSocratize = useCallback(async () => {
    if (isStreaming) return
    setError(null)
    setIsStreaming(true)
    socratizeFollowUps.current = []

    let assistantText = ''
    setStreamingText('')

    try {
      const response = await fetch(`/api/sessions/${sessionId}/socratize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUps: [] }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error ?? 'Failed to start Socratize')
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let gotDocOps = false

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
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
            gotDocOps = true
          } else if (event.type === 'error') {
            throw new Error(event.message)
          } else if (event.type === 'done') {
            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: assistantText,
              isSocratize: true,
            }
            setMessages(prev => [...prev, assistantMsg])
            setStreamingText('')
            socratizeFollowUps.current.push({ role: 'assistant', content: assistantText })

            if (gotDocOps) {
              socratizeFollowUps.current = []
              onSocratizeDone()
            }
          }
        }
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsStreaming(false)
    }
  }, [sessionId, isStreaming, onDocOps, onSocratizeDone])

  const triggerKbSession = useCallback(async () => {
    if (isStreaming) return
    setError(null)
    setIsStreaming(true)

    let assistantText = ''
    setStreamingText('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: '__KB_START__', isKbTrigger: true }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error ?? 'Failed to start KB session')
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          if (!frame.startsWith('data: ')) continue
          const event = JSON.parse(frame.slice(6))

          if (event.type === 'text') {
            assistantText += event.delta
            setStreamingText(assistantText)
          } else if (event.type === 'file_update') {
            onFileUpdate?.({ filename: event.filename, content: event.content })
          } else if (event.type === 'error') {
            throw new Error(event.message)
          } else if (event.type === 'done') {
            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: assistantText,
            }
            setMessages(prev => [...prev, assistantMsg])
            setStreamingText('')
          }
        }
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsStreaming(false)
    }
  }, [sessionId, isStreaming, onFileUpdate])

  return { messages, streamingText, isStreaming, error, sendMessage, startSocratize, triggerSocratize, triggerKbSession }
}
