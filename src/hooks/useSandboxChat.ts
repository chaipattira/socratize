import { useState, useCallback, useRef } from 'react'

export interface SandboxMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isInit?: boolean
  toolCalls?: Array<{ name: string; input: Record<string, unknown>; done: boolean }>
  thinking?: string
}

interface UseSandboxChatOptions {
  sandboxId: string
  initialMessages?: SandboxMessage[]
  onFileUpdate?: (update: { filename: string; content: string }) => void
  onSkillsLoaded?: (skills: string[]) => void
  onCommandRun?: () => void
  onCommandComplete?: () => void
}

const INIT_MESSAGE = 'List all available skills and read a preview of each one. Also list the workspace files so you know what\'s available. Summarize what you\'re equipped to help with and what files are in the workspace.'

export function useSandboxChat({
  sandboxId,
  initialMessages = [],
  onFileUpdate,
  onSkillsLoaded,
  onCommandRun,
  onCommandComplete,
}: UseSandboxChatOptions) {
  const [messages, setMessages] = useState<SandboxMessage[]>(initialMessages)
  const [streamingText, setStreamingText] = useState('')
  const [streamingToolCalls, setStreamingToolCalls] = useState<Array<{ name: string; input: Record<string, unknown>; done: boolean }>>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const isStreamingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const followUps = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const abortRef = useRef<AbortController | null>(null)

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const runStream = useCallback(async (
    userContent: string,
    isInit: boolean,
    opts: { thinkingEnabled?: boolean; enabledSkills?: string[] } = {}
  ) => {
    if (isStreamingRef.current) return
    isStreamingRef.current = true
    setError(null)
    setIsStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    if (!isInit) {
      const userMsg: SandboxMessage = { id: crypto.randomUUID(), role: 'user', content: userContent }
      setMessages(prev => [...prev, userMsg])
      followUps.current.push({ role: 'user', content: userContent })
    }

    let assistantText = ''
    let assistantThinking = ''
    let toolCallsList: Array<{ name: string; input: Record<string, unknown>; done: boolean }> = []
    setStreamingText('')
    setStreamingToolCalls([])

    try {
      const response = await fetch(`/api/sandboxes/${sandboxId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userContent,
          followUps: followUps.current,
          thinkingEnabled: opts.thinkingEnabled ?? false,
          enabledSkills: opts.enabledSkills ?? null,
        }),
        signal: abort.signal,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error ?? 'Failed to send message')
      }

      if (!response.body) throw new Error('Response body is null')
      const reader = response.body.getReader()
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

          if (event.type === 'thinking') {
            assistantThinking += event.delta
          } else if (event.type === 'text') {
            assistantText += event.delta
            setStreamingText(assistantText)
          } else if (event.type === 'tool_call') {
            toolCallsList = [...toolCallsList, { name: event.name, input: event.input ?? {}, done: false }]
            setStreamingToolCalls([...toolCallsList])
            if (event.name === 'run_command') onCommandRun?.()
          } else if (event.type === 'tool_result') {
            const idx = toolCallsList.findLastIndex(tc => !tc.done)
            if (idx !== -1) {
              const completedName = toolCallsList[idx].name
              toolCallsList = toolCallsList.map((tc, i) => i === idx ? { ...tc, done: true } : tc)
              setStreamingToolCalls([...toolCallsList])
              if (completedName === 'run_command') onCommandComplete?.()
            }
          } else if (event.type === 'file_update') {
            onFileUpdate?.({ filename: event.filename, content: event.content })
          } else if (event.type === 'error') {
            throw new Error(event.message)
          } else if (event.type === 'done') {
            const assistantMsg: SandboxMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: assistantText,
              isInit,
              toolCalls: toolCallsList.length ? toolCallsList : undefined,
              thinking: assistantThinking || undefined,
            }
            setMessages(prev => [...prev, assistantMsg])
            setStreamingText('')
            setStreamingToolCalls([])

            if (!isInit) {
              followUps.current.push({ role: 'assistant', content: assistantText })
            }

            // Parse skill names from init response tool calls
            if (isInit) {
              const previewCalls = toolCallsList.filter(tc => tc.name === 'read_skill_preview')
              const skills = previewCalls.map(tc => String(tc.input.filename)).filter(Boolean)
              if (skills.length > 0) onSkillsLoaded?.(skills)
              setInitStatus('done')
            }
          }
        }
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      if (!isAbort) {
        setError(String(err))
        if (!isInit) {
          setMessages(prev => prev.slice(0, -1))
          followUps.current = followUps.current.slice(0, -1)
        }
        if (isInit) setInitStatus('error')
      }
    } finally {
      isStreamingRef.current = false
      setIsStreaming(false)
      if (isInit) setInitStatus(prev => prev === 'loading' ? 'error' : prev)
    }
  }, [sandboxId, onFileUpdate, onSkillsLoaded, onCommandRun, onCommandComplete])

  const triggerInit = useCallback(() => {
    setInitStatus('loading')
    runStream(INIT_MESSAGE, true)
  }, [runStream])

  const sendMessage = useCallback((content: string, opts: { thinkingEnabled?: boolean; enabledSkills?: string[] } = {}) => {
    runStream(content, false, opts)
  }, [runStream])

  return {
    messages,
    streamingText,
    streamingToolCalls,
    isStreaming,
    error,
    initStatus,
    triggerInit,
    sendMessage,
    stopStreaming,
  }
}
