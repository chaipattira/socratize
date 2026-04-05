import { useState, useCallback, useRef } from 'react'
import { type DocOp } from '@/lib/doc-ops'

export interface ThinkingBlock {
  text: string
}

export interface ToolCallItem {
  name: string
  input: Record<string, unknown>
  done: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isSocratize?: boolean
  thinking?: ThinkingBlock
  toolCalls?: ToolCallItem[]
}

interface UseChatOptions {
  sessionId: string
  initialMessages?: ChatMessage[]
  onDocOps: (ops: DocOp[]) => void
  onFileUpdate?: (update: { filename: string; content: string }) => void
  phase: 'building' | 'testing' | null
  thinkingEnabled?: boolean
  selectedSkillFile?: string
}

export function useChat({
  sessionId,
  initialMessages = [],
  onDocOps,
  onFileUpdate,
  phase,
  thinkingEnabled = false,
  selectedSkillFile,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [streamingText, setStreamingText] = useState('')
  const [streamingThinking, setStreamingThinking] = useState('')
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCallItem[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Separate conversation histories for each phase
  const buildFollowUps = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const testFollowUps = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return
      setError(null)
      setIsStreaming(true)

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        isSocratize: phase !== null,
      }
      setMessages(prev => [...prev, userMsg])

      let assistantText = ''
      let thinkingText = ''
      let toolCallsList: ToolCallItem[] = []
      setStreamingText('')
      setStreamingThinking('')
      setStreamingToolCalls([])

      try {
        let response: Response

        if (phase === 'building') {
          buildFollowUps.current.push({ role: 'user', content })
          response = await fetch(`/api/sessions/${sessionId}/socratize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ followUps: buildFollowUps.current }),
          })
        } else if (phase === 'testing') {
          testFollowUps.current.push({ role: 'user', content })
          response = await fetch(`/api/sessions/${sessionId}/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ followUps: testFollowUps.current, selectedSkillFile }),
          })
        } else {
          response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message: content, thinkingEnabled }),
          })
        }

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
          const frames = buffer.split('\n\n')
          buffer = frames.pop() ?? ''

          for (const frame of frames) {
            if (!frame.startsWith('data: ')) continue
            const event = JSON.parse(frame.slice(6))

            if (event.type === 'text') {
              assistantText += event.delta
              setStreamingText(assistantText)
            } else if (event.type === 'thinking') {
              thinkingText += event.delta
              setStreamingThinking(thinkingText)
            } else if (event.type === 'tool_call') {
              toolCallsList = [...toolCallsList, { name: event.name, input: event.input ?? {}, done: false }]
              setStreamingToolCalls([...toolCallsList])
            } else if (event.type === 'tool_result') {
              const idx = toolCallsList.findLastIndex(tc => !tc.done)
              if (idx !== -1) {
                toolCallsList = toolCallsList.map((tc, i) => i === idx ? { ...tc, done: true } : tc)
                setStreamingToolCalls([...toolCallsList])
              }
            } else if (event.type === 'doc_ops') {
              onDocOps(event.ops)
              // In both building and testing phases, doc_ops just updates the skill.
              // There is no phase transition — that's determined by extractionMode at session creation.
            } else if (event.type === 'file_update') {
              onFileUpdate?.({ filename: event.filename, content: event.content })
            } else if (event.type === 'error') {
              throw new Error(event.message)
            } else if (event.type === 'done') {
              const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: assistantText,
                isSocratize: phase !== null,
                thinking: thinkingText ? { text: thinkingText } : undefined,
                toolCalls: toolCallsList.length ? toolCallsList : undefined,
              }
              setMessages(prev => [...prev, assistantMsg])
              setStreamingText('')
              setStreamingThinking('')
              setStreamingToolCalls([])

              if (phase === 'building') {
                buildFollowUps.current.push({ role: 'assistant', content: assistantText })
              } else if (phase === 'testing') {
                testFollowUps.current.push({ role: 'assistant', content: assistantText })
              }
            }
          }
        }
      } catch (err) {
        setError(String(err))
        setMessages(prev => prev.slice(0, -1))
        if (phase === 'building') {
          buildFollowUps.current = buildFollowUps.current.slice(0, -1)
        } else if (phase === 'testing') {
          testFollowUps.current = testFollowUps.current.slice(0, -1)
        }
      } finally {
        setIsStreaming(false)
      }
    },
    [sessionId, isStreaming, onDocOps, onFileUpdate, phase, thinkingEnabled, selectedSkillFile]
  )

  // Fires the first LLM turn for the build phase (no prior user message)
  const triggerBuildPhase = useCallback(async () => {
    if (isStreaming) return
    setError(null)
    setIsStreaming(true)
    buildFollowUps.current = []

    let assistantText = ''
    let thinkingText = ''
    let toolCallsList: ToolCallItem[] = []
    setStreamingText('')
    setStreamingThinking('')
    setStreamingToolCalls([])

    try {
      const response = await fetch(`/api/sessions/${sessionId}/socratize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUps: [] }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error ?? 'Failed to start build phase')
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
          } else if (event.type === 'tool_call') {
            toolCallsList = [...toolCallsList, { name: event.name, input: event.input ?? {}, done: false }]
            setStreamingToolCalls([...toolCallsList])
          } else if (event.type === 'tool_result') {
            const idx = toolCallsList.findLastIndex(tc => !tc.done)
            if (idx !== -1) {
              toolCallsList = toolCallsList.map((tc, i) => i === idx ? { ...tc, done: true } : tc)
              setStreamingToolCalls([...toolCallsList])
            }
          } else if (event.type === 'file_update') {
            onFileUpdate?.({ filename: event.filename, content: event.content })
          } else if (event.type === 'doc_ops') {
            onDocOps(event.ops)
          } else if (event.type === 'error') {
            throw new Error(event.message)
          } else if (event.type === 'done') {
            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: assistantText,
              isSocratize: true,
              toolCalls: toolCallsList.length ? toolCallsList : undefined,
            }
            setMessages(prev => [...prev, assistantMsg])
            setStreamingText('')
            setStreamingThinking('')
            setStreamingToolCalls([])
            buildFollowUps.current.push({ role: 'assistant', content: assistantText })
          }
        }
      }
    } catch (err) {
      setError(String(err))
      setStreamingToolCalls([])
    } finally {
      setIsStreaming(false)
    }
  }, [sessionId, isStreaming, onDocOps, onFileUpdate])

  const triggerKbSession = useCallback(async () => {
    if (isStreaming) return
    setError(null)
    setIsStreaming(true)

    let assistantText = ''
    let thinkingText = ''
    let toolCallsList: ToolCallItem[] = []
    setStreamingText('')
    setStreamingThinking('')
    setStreamingToolCalls([])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: '__KB_START__', isKbTrigger: true, thinkingEnabled }),
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
          } else if (event.type === 'thinking') {
            thinkingText += event.delta
            setStreamingThinking(thinkingText)
          } else if (event.type === 'tool_call') {
            toolCallsList = [...toolCallsList, { name: event.name, input: event.input ?? {}, done: false }]
            setStreamingToolCalls([...toolCallsList])
          } else if (event.type === 'tool_result') {
            const idx = toolCallsList.findLastIndex(tc => !tc.done)
            if (idx !== -1) {
              toolCallsList = toolCallsList.map((tc, i) => i === idx ? { ...tc, done: true } : tc)
              setStreamingToolCalls([...toolCallsList])
            }
          } else if (event.type === 'file_update') {
            onFileUpdate?.({ filename: event.filename, content: event.content })
          } else if (event.type === 'error') {
            throw new Error(event.message)
          } else if (event.type === 'done') {
            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: assistantText,
              thinking: thinkingText ? { text: thinkingText } : undefined,
              toolCalls: toolCallsList.length ? toolCallsList : undefined,
            }
            setMessages(prev => [...prev, assistantMsg])
            setStreamingText('')
            setStreamingThinking('')
            setStreamingToolCalls([])
          }
        }
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsStreaming(false)
    }
  }, [sessionId, isStreaming, onFileUpdate, thinkingEnabled])

  return {
    messages,
    streamingText,
    streamingThinking,
    streamingToolCalls,
    isStreaming,
    error,
    sendMessage,
    triggerBuildPhase,
    triggerKbSession,
  }
}
