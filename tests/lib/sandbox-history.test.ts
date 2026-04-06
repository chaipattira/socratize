import { describe, it, expect } from 'vitest'
import { buildLlmHistory } from '@/lib/sandbox-history'

describe('buildLlmHistory', () => {
  it('builds simple text-only history', () => {
    const msgs = [
      { role: 'user', content: 'hello', toolHistory: null },
      { role: 'assistant', content: 'hi there', toolHistory: null },
      { role: 'user', content: 'run some code', toolHistory: null },
      { role: 'assistant', content: 'done', toolHistory: null },
    ]
    expect(buildLlmHistory(msgs)).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'user', content: 'run some code' },
      { role: 'assistant', content: 'done' },
    ])
  })

  it('interleaves tool history before final assistant text', () => {
    const toolDelta = [
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'run_command', input: { command: 'ls' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'file.R' }] },
    ]
    const msgs = [
      { role: 'user', content: 'list files', toolHistory: null },
      { role: 'assistant', content: 'Here are the files: file.R', toolHistory: JSON.stringify(toolDelta) },
    ]
    expect(buildLlmHistory(msgs)).toEqual([
      { role: 'user', content: 'list files' },
      ...toolDelta,
      { role: 'assistant', content: 'Here are the files: file.R' },
    ])
  })

  it('handles multiple tool call iterations in one exchange', () => {
    const toolDelta = [
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'run_command', input: { command: 'Rscript a.R' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'error: not found' }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'run_command', input: { command: 'Rscript b.R' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't2', content: '[1] 42' }] },
    ]
    const msgs = [
      { role: 'user', content: 'run the script', toolHistory: null },
      { role: 'assistant', content: 'The result is 42', toolHistory: JSON.stringify(toolDelta) },
    ]
    expect(buildLlmHistory(msgs)).toEqual([
      { role: 'user', content: 'run the script' },
      ...toolDelta,
      { role: 'assistant', content: 'The result is 42' },
    ])
  })

  it('handles empty message list', () => {
    expect(buildLlmHistory([])).toEqual([])
  })

  it('silently drops messages with unrecognized roles', () => {
    const msgs = [
      { role: 'user', content: 'hello', toolHistory: null },
      { role: 'system', content: 'you are helpful', toolHistory: null },
      { role: 'assistant', content: 'hi', toolHistory: null },
    ]
    expect(buildLlmHistory(msgs)).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ])
  })
})
