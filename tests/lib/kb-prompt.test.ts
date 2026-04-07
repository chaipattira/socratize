import { describe, it, expect } from 'vitest'
import { buildKbSystemPrompt } from '@/lib/kb-prompt'

describe('buildKbSystemPrompt', () => {
  it('includes instructions to call list_files', () => {
    const prompt = buildKbSystemPrompt()
    expect(prompt).toContain('list_files')
  })

  it('includes instructions to call read_file', () => {
    const prompt = buildKbSystemPrompt()
    expect(prompt).toContain('read_file')
  })

  it('includes instructions to call update_file', () => {
    const prompt = buildKbSystemPrompt()
    expect(prompt).toContain('update_file')
  })

  it('includes instructions to call create_file', () => {
    const prompt = buildKbSystemPrompt()
    expect(prompt).toContain('create_file')
  })

  it('mentions START trigger for session opening', () => {
    const prompt = buildKbSystemPrompt()
    expect(prompt).toContain('__KB_START__')
  })

  it('includes guided extraction phases', () => {
    const prompt = buildKbSystemPrompt()
    expect(prompt).toContain('Triggers')
    expect(prompt).toContain('Failure Modes')
  })

  it('includes skeptical-expert framing', () => {
    const prompt = buildKbSystemPrompt()
    expect(prompt).toContain('precise, skeptical, and deliberate')
  })

  it('includes question quality bar', () => {
    const prompt = buildKbSystemPrompt()
    expect(prompt).toContain('Actionable')
    expect(prompt).toContain('Non-leading')
    expect(prompt).toContain('Grounded')
  })

  it('includes question taxonomy', () => {
    const prompt = buildKbSystemPrompt()
    expect(prompt).toContain('Disambiguation')
    expect(prompt).toContain('Hypothetical')
    expect(prompt).toContain('Missing/implicit')
  })
})
