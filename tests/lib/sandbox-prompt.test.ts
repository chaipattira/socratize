import { describe, it, expect } from 'vitest'
import type OpenAI from 'openai'
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
    const names = SANDBOX_TOOLS_OPENAI.map(t => (t as OpenAI.Chat.ChatCompletionFunctionTool).function.name)
    expect(names).toContain('list_skills')
    expect(names).toContain('read_skill')
    expect(names).toContain('read_skill_preview')
    expect(names).toContain('list_files')
    expect(names).toContain('read_file')
    expect(names).toContain('write_file')
  })
})

describe('built-in skills index', () => {
  it('references builtin/r-code.md', () => {
    expect(buildSandboxSystemPrompt()).toContain('builtin/r-code.md')
  })

  it('references builtin/file-loading.md', () => {
    expect(buildSandboxSystemPrompt()).toContain('builtin/file-loading.md')
  })

  it('does not inline R patterns directly', () => {
    // Baseline content moved to builtin skill files — not in prompt
    expect(buildSandboxSystemPrompt()).not.toContain('join_by()')
    expect(buildSandboxSystemPrompt()).not.toContain('native pipe')
  })
})

describe('scratch.md instructions', () => {
  it('instructs agent to check for scratch.md on startup', () => {
    expect(buildSandboxSystemPrompt()).toContain('scratch.md')
  })

  it('mentions SUMMARY INDEX markers', () => {
    expect(buildSandboxSystemPrompt()).toContain('SUMMARY INDEX')
  })

  it('instructs agent to skip install output', () => {
    const prompt = buildSandboxSystemPrompt()
    expect(prompt.toLowerCase()).toMatch(/pip|install/)
    expect(prompt.toLowerCase()).toContain('skip')
  })
})

describe('writing voice', () => {
  it('sandbox prompt includes active voice rule', () => {
    expect(buildSandboxSystemPrompt()).toContain('active voice')
  })

  it('sandbox prompt includes omit needless words rule', () => {
    expect(buildSandboxSystemPrompt()).toContain('Omit needless words')
  })
})
