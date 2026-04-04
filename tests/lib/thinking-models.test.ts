import { describe, it, expect } from 'vitest'
import { supportsThinking } from '@/lib/thinking-models'

describe('supportsThinking', () => {
  describe('anthropic', () => {
    it('returns true for claude-4 models', () => {
      expect(supportsThinking('anthropic', 'claude-opus-4-6')).toBe(true)
      expect(supportsThinking('anthropic', 'claude-sonnet-4-6')).toBe(true)
      expect(supportsThinking('anthropic', 'claude-haiku-4-5')).toBe(true)
    })
    it('returns true for claude-3-7 models', () => {
      expect(supportsThinking('anthropic', 'claude-3-7-sonnet-20250219')).toBe(true)
    })
    it('returns false for older models', () => {
      expect(supportsThinking('anthropic', 'claude-3-5-sonnet-20241022')).toBe(false)
    })
  })

  describe('openai', () => {
    it('returns true for o-series models', () => {
      expect(supportsThinking('openai', 'o3')).toBe(true)
      expect(supportsThinking('openai', 'o4-mini')).toBe(true)
    })
    it('returns true for gpt-5 models', () => {
      expect(supportsThinking('openai', 'gpt-5.4')).toBe(true)
      expect(supportsThinking('openai', 'gpt-5.4-mini')).toBe(true)
    })
    it('returns false for gpt-4 models', () => {
      expect(supportsThinking('openai', 'gpt-4o')).toBe(false)
    })
  })

  it('returns false for unknown providers', () => {
    expect(supportsThinking('other', 'some-model')).toBe(false)
  })
})
