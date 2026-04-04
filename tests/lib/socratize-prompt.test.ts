import { describe, it, expect } from 'vitest'
import { buildSocratizeSystemPrompt, buildSocratizeMessages } from '@/lib/socratize-prompt'

describe('buildSocratizeSystemPrompt', () => {
  it('returns a non-empty string', () => {
    expect(buildSocratizeSystemPrompt().length).toBeGreaterThan(100)
  })

  it('instructs Claude to produce SKILL.md', () => {
    expect(buildSocratizeSystemPrompt()).toContain('SKILL.md')
  })

  it('instructs Claude to call update_document once when ready', () => {
    const prompt = buildSocratizeSystemPrompt()
    expect(prompt).toContain('update_document')
    expect(prompt).toContain('once')
  })

  it('describes the "Use when" description rule', () => {
    expect(buildSocratizeSystemPrompt()).toContain('Use when')
  })

  it('does not use all-caps mandates', () => {
    const prompt = buildSocratizeSystemPrompt()
    expect(prompt).not.toMatch(/\bALWAYS\b/)
    expect(prompt).not.toMatch(/\bNEVER\b/)
  })
})

describe('buildSocratizeMessages', () => {
  it('uses the session title as first user message', () => {
    const messages = buildSocratizeMessages('How I do code review')
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toContain('How I do code review')
  })

  it('appends follow-up messages when provided', () => {
    const followUps = [
      { role: 'assistant' as const, content: 'What triggers this?' },
      { role: 'user' as const, content: 'When the build fails.' },
    ]
    const messages = buildSocratizeMessages('Code review', followUps)
    expect(messages).toHaveLength(3)
    expect(messages[2]).toEqual({ role: 'user', content: 'When the build fails.' })
  })
})
