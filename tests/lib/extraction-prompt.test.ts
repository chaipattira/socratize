import { describe, it, expect } from 'vitest'
import {
  buildSystemPrompt,
  UPDATE_DOCUMENT_TOOL,
  UPDATE_DOCUMENT_TOOL_OPENAI,
  buildMessages,
} from '@/lib/extraction-prompt'

describe('buildSystemPrompt', () => {
  it('includes the current document state', () => {
    const prompt = buildSystemPrompt('## When to Use\n\nFoo.')
    expect(prompt).toContain('## When to Use')
    expect(prompt).toContain('Foo.')
  })

  it('uses empty document placeholder when document is empty', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('(empty)')
  })

  it('includes all extraction phases', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('Triggers')
    expect(prompt).toContain('Failure Modes')
    expect(prompt).toContain('Edge Cases')
  })

  it('opens with an adaptive prompt that works for both guided and direct users', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('If you have a structure in mind')
  })

  it('ignores the legacy mode parameter', () => {
    const prompted = buildSystemPrompt('doc', 'guided')
    const promptDirect = buildSystemPrompt('doc', 'direct')
    expect(prompted).toBe(promptDirect)
  })
})

describe('UPDATE_DOCUMENT_TOOL', () => {
  it('is named update_document', () => {
    expect(UPDATE_DOCUMENT_TOOL.name).toBe('update_document')
  })
})

describe('UPDATE_DOCUMENT_TOOL_OPENAI', () => {
  it('wraps in function type', () => {
    expect(UPDATE_DOCUMENT_TOOL_OPENAI.type).toBe('function')
    expect(UPDATE_DOCUMENT_TOOL_OPENAI.function.name).toBe('update_document')
  })
})

describe('buildMessages', () => {
  it('filters to user and assistant roles only', () => {
    const msgs = buildMessages([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'system', content: 'ignored' },
    ])
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
  })

  it('appends new user message when provided', () => {
    const msgs = buildMessages([], 'new message')
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toEqual({ role: 'user', content: 'new message' })
  })
})
