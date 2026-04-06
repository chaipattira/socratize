import { describe, it, expect } from 'vitest'
import { buildKbSystemPrompt } from '@/lib/kb-prompt'

describe('buildKbSystemPrompt', () => {
  it('includes instructions to call list_files', () => {
    const prompt = buildKbSystemPrompt('guided')
    expect(prompt).toContain('list_files')
  })

  it('includes instructions to call read_file', () => {
    const prompt = buildKbSystemPrompt('guided')
    expect(prompt).toContain('read_file')
  })

  it('includes instructions to call update_file', () => {
    const prompt = buildKbSystemPrompt('guided')
    expect(prompt).toContain('update_file')
  })

  it('includes instructions to call create_file', () => {
    const prompt = buildKbSystemPrompt('guided')
    expect(prompt).toContain('create_file')
  })

  it('mentions START trigger for session opening', () => {
    const prompt = buildKbSystemPrompt('guided')
    expect(prompt).toContain('__KB_START__')
  })

  it('includes guided extraction phases for guided mode', () => {
    const prompt = buildKbSystemPrompt('guided')
    expect(prompt).toContain('Triggers')
    expect(prompt).toContain('Failure Modes')
  })

  it('includes structured intake style for direct mode', () => {
    const prompt = buildKbSystemPrompt('direct')
    expect(prompt).toContain('Name & Audience')
  })

  it('includes skeptical-expert framing in guided mode', () => {
    const prompt = buildKbSystemPrompt('guided')
    expect(prompt).toContain('precise, skeptical, and deliberate')
  })

  it('includes question quality bar in guided mode', () => {
    const prompt = buildKbSystemPrompt('guided')
    expect(prompt).toContain('Actionable')
    expect(prompt).toContain('Non-leading')
    expect(prompt).toContain('Grounded')
  })

  it('includes question taxonomy in guided mode', () => {
    const prompt = buildKbSystemPrompt('guided')
    expect(prompt).toContain('Disambiguation')
    expect(prompt).toContain('Hypothetical')
    expect(prompt).toContain('Missing/implicit')
  })

  it('includes skeptical-expert framing in direct mode', () => {
    const prompt = buildKbSystemPrompt('direct')
    expect(prompt).toContain('precise, skeptical, and deliberate')
  })

  it('includes question quality bar in direct mode', () => {
    const prompt = buildKbSystemPrompt('direct')
    expect(prompt).toContain('Actionable')
    expect(prompt).toContain('Non-leading')
    expect(prompt).toContain('Grounded')
  })

  it('includes question taxonomy in direct mode', () => {
    const prompt = buildKbSystemPrompt('direct')
    expect(prompt).toContain('Disambiguation')
    expect(prompt).toContain('Hypothetical')
    expect(prompt).toContain('Missing/implicit')
  })
})
