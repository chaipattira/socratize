interface DbMessage {
  role: string
  content: string
  toolHistory: string | null
}

type LlmMessage = { role: string; content: unknown }

export function buildLlmHistory(dbMessages: DbMessage[]): LlmMessage[] {
  const result: LlmMessage[] = []
  for (const msg of dbMessages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      if (msg.toolHistory) {
        try {
          const delta = JSON.parse(msg.toolHistory) as LlmMessage[]
          result.push(...delta)
        } catch {
          // Corrupted toolHistory row — skip tool turn rather than crashing
        }
      }
      result.push({ role: 'assistant', content: msg.content })
    }
  }
  return result
}
