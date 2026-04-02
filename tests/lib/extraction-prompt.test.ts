import { describe, it, expect } from 'vitest'
import {
  buildSystemPrompt,
  UPDATE_DOCUMENT_TOOL,
  UPDATE_DOCUMENT_TOOL_OPENAI,
  buildMessages,
} from '@/lib/extraction-prompt'

describe('buildSystemPrompt guided mode', () => {
  it('includes the current document state', () => {
    const prompt = buildSystemPrompt('## When to Use\n\nFoo.', 'guided')
    expect(prompt).toContain('## When to Use')
    expect(prompt).toContain('Foo.')
  })

  it('uses empty document placeholder when document is empty', () => {
    const prompt = buildSystemPrompt('', 'guided')
    expect(prompt).toContain('(empty)')
  })

  it('includes skill-shaped extraction phases', () => {
    const prompt = buildSystemPrompt('', 'guided')
    expect(prompt).toContain('Triggers')
    expect(prompt).toContain('Failure Modes')
    expect(prompt).toContain('Edge Cases')
  })

  it('opens with the tacit-knowledge question', () => {
    const prompt = buildSystemPrompt('', 'guided')
    expect(prompt).toContain('other people on your team')
  })
})

describe('buildSystemPrompt direct mode', () => {
  it('includes the current document state', () => {
    const prompt = buildSystemPrompt('## Process\n\nBar.', 'direct')
    expect(prompt).toContain('## Process')
    expect(prompt).toContain('Bar.')
  })

  it('uses empty document placeholder when document is empty', () => {
    const prompt = buildSystemPrompt('', 'direct')
    expect(prompt).toContain('(empty)')
  })

  it('opens with structured intake', () => {
    const prompt = buildSystemPrompt('', 'direct')
    expect(prompt).toContain('name of this')
    expect(prompt).toContain('step')
  })
})

describe('UPDATE_DOCUMENT_TOOL', () => {
  it('has required fields for Anthropic tool format', () => {
    expect(UPDATE_DOCUMENT_TOOL.name).toBe('update_document')
    expect(UPDATE_DOCUMENT_TOOL.input_schema).toBeDefined()
    expect(UPDATE_DOCUMENT_TOOL.input_schema.properties.ops).toBeDefined()
  })
})

describe('UPDATE_DOCUMENT_TOOL_OPENAI', () => {
  it('has OpenAI function tool format', () => {
    expect(UPDATE_DOCUMENT_TOOL_OPENAI.type).toBe('function')
    expect(UPDATE_DOCUMENT_TOOL_OPENAI.function.name).toBe('update_document')
    expect(UPDATE_DOCUMENT_TOOL_OPENAI.function.parameters).toBeDefined()
  })
})

describe('buildMessages', () => {
  it('converts stored messages to Anthropic format', () => {
    const stored = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]
    const messages = buildMessages(stored)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' })
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there' })
  })

  it('adds a new user message when provided', () => {
    const messages = buildMessages([], 'New question')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual({ role: 'user', content: 'New question' })
  })

  it('filters out non-user/assistant roles', () => {
    const stored = [
      { role: 'system', content: 'sys prompt' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]
    const messages = buildMessages(stored)
    expect(messages).toHaveLength(2)
    expect(messages.every(m => m.role === 'user' || m.role === 'assistant')).toBe(true)
  })
})
