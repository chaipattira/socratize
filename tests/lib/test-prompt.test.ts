import { describe, it, expect } from 'vitest'
import { buildTestSystemPrompt, buildTestMessages } from '@/lib/test-prompt'

describe('buildTestSystemPrompt', () => {
  it('returns a non-empty string', () => {
    expect(buildTestSystemPrompt('## My Skill\n\nDo the thing.').length).toBeGreaterThan(100)
  })

  it('embeds the skill content', () => {
    const prompt = buildTestSystemPrompt('## My Skill\n\nDo the thing.')
    expect(prompt).toContain('## My Skill')
    expect(prompt).toContain('Do the thing.')
  })

  it('handles empty skill gracefully', () => {
    expect(buildTestSystemPrompt('')).toContain('(empty)')
  })

  it('describes probing move types', () => {
    const prompt = buildTestSystemPrompt('skill')
    expect(prompt).toContain('Variation pick')
    expect(prompt).toContain('Scope probe')
    expect(prompt).toContain('Inversion')
  })

  it('instructs generalizing rather than patching', () => {
    expect(buildTestSystemPrompt('skill')).toContain('generaliz')
  })

  it('does not use all-caps mandates', () => {
    const prompt = buildTestSystemPrompt('skill')
    expect(prompt).not.toMatch(/\bALWAYS\b/)
    expect(prompt).not.toMatch(/\bNEVER\b/)
  })
})

describe('buildTestMessages', () => {
  it('returns empty array when no followUps', () => {
    expect(buildTestMessages()).toHaveLength(0)
  })

  it('returns followUps as-is', () => {
    const followUps = [
      { role: 'user' as const, content: 'Write me a poem.' },
      { role: 'assistant' as const, content: 'Here is a poem...' },
    ]
    expect(buildTestMessages(followUps)).toEqual(followUps)
  })
})
