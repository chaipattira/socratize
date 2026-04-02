import { describe, it, expect } from 'vitest'
import {
  buildSystemPrompt,
  UPDATE_DOCUMENT_TOOL,
  UPDATE_DOCUMENT_TOOL_OPENAI,
  buildMessages,
} from '@/lib/extraction-prompt'

describe('buildSystemPrompt', () => {
  it('includes the current document state', () => {
    const prompt = buildSystemPrompt('## Core Concepts\n\nFoo.')
    expect(prompt).toContain('## Core Concepts')
    expect(prompt).toContain('Foo.')
  })

  it('includes extraction phase instructions', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('Scope & Context')
    expect(prompt).toContain('Core Concepts')
    expect(prompt).toContain('Misconceptions')
  })

  it('uses empty document placeholder when document is empty', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('(empty)')
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
