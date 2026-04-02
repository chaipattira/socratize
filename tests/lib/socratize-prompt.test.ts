import { describe, it, expect } from 'vitest'
import { buildSocratizeSystemPrompt, buildSocratizeMessages } from '@/lib/socratize-prompt'

describe('buildSocratizeSystemPrompt', () => {
  it('returns a non-empty string', () => {
    expect(buildSocratizeSystemPrompt().length).toBeGreaterThan(100)
  })

  it('instructs Claude to produce SKILL.md', () => {
    const prompt = buildSocratizeSystemPrompt()
    expect(prompt).toContain('SKILL.md')
  })

  it('requires description to start with "Use when"', () => {
    const prompt = buildSocratizeSystemPrompt()
    expect(prompt).toContain('Use when')
  })

  it('allows up to 3 clarifying questions before generating', () => {
    const prompt = buildSocratizeSystemPrompt()
    expect(prompt).toContain('3')
  })
})

describe('buildSocratizeMessages', () => {
  it('wraps extracted markdown as first user message', () => {
    const messages = buildSocratizeMessages('## Overview\n\nFoo.')
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toContain('## Overview')
    expect(messages[0].content).toContain('Foo.')
  })

  it('appends follow-up messages when provided', () => {
    const followUps = [
      { role: 'assistant' as const, content: 'What triggers this?' },
      { role: 'user' as const, content: 'When the build fails.' },
    ]
    const messages = buildSocratizeMessages('## Overview\n\nFoo.', followUps)
    expect(messages).toHaveLength(3)
    expect(messages[2]).toEqual({ role: 'user', content: 'When the build fails.' })
  })
})
