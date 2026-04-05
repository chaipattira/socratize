import { describe, it, expect } from 'vitest'
import {
  buildSandboxSystemPrompt,
  SANDBOX_TOOLS_ANTHROPIC,
  SANDBOX_TOOLS_OPENAI,
} from '@/lib/sandbox-prompt'

describe('buildSandboxSystemPrompt', () => {
  it('mentions skill tools', () => {
    const prompt = buildSandboxSystemPrompt()
    expect(prompt).toContain('list_skills')
    expect(prompt).toContain('read_skill')
    expect(prompt).toContain('read_skill_preview')
  })

  it('mentions workspace tools', () => {
    const prompt = buildSandboxSystemPrompt()
    expect(prompt).toContain('list_files')
    expect(prompt).toContain('read_file')
    expect(prompt).toContain('write_file')
  })

  it('instructs agent to read skill before responding', () => {
    const prompt = buildSandboxSystemPrompt()
    expect(prompt.toLowerCase()).toContain('relevant')
  })
})

describe('SANDBOX_TOOLS_ANTHROPIC', () => {
  it('defines all 6 tools', () => {
    const names = SANDBOX_TOOLS_ANTHROPIC.map(t => t.name)
    expect(names).toContain('list_skills')
    expect(names).toContain('read_skill')
    expect(names).toContain('read_skill_preview')
    expect(names).toContain('list_files')
    expect(names).toContain('read_file')
    expect(names).toContain('write_file')
  })
})

describe('SANDBOX_TOOLS_OPENAI', () => {
  it('defines all 6 tools', () => {
    const names = SANDBOX_TOOLS_OPENAI.map(t => t.function.name)
    expect(names).toContain('list_skills')
    expect(names).toContain('read_skill')
    expect(names).toContain('read_skill_preview')
    expect(names).toContain('list_files')
    expect(names).toContain('read_file')
    expect(names).toContain('write_file')
  })
})
