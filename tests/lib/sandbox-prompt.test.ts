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

describe('baseline skills — R code writing', () => {
  it('includes native pipe instruction', () => {
    expect(buildSandboxSystemPrompt()).toContain('native pipe')
  })

  it('includes join_by instruction', () => {
    expect(buildSandboxSystemPrompt()).toContain('join_by()')
  })

  it('includes .by grouping instruction', () => {
    expect(buildSandboxSystemPrompt()).toContain('.by')
  })

  it('includes haven::read_sas instruction for SAS files', () => {
    expect(buildSandboxSystemPrompt()).toContain('haven::read_sas')
  })

  it('warns about SAS files', () => {
    expect(buildSandboxSystemPrompt()).toContain('.sas7bdat')
  })
})

describe('baseline skills — file loading', () => {
  it('instructs agent to use .txt companion', () => {
    expect(buildSandboxSystemPrompt()).toContain('.txt companion')
  })

  it('covers docx extraction', () => {
    expect(buildSandboxSystemPrompt()).toContain('python-docx')
  })

  it('covers pdf extraction', () => {
    expect(buildSandboxSystemPrompt()).toContain('pypdf')
  })

  it('covers pptx extraction', () => {
    expect(buildSandboxSystemPrompt()).toContain('markitdown')
  })

  it('covers xlsx extraction', () => {
    expect(buildSandboxSystemPrompt()).toContain('openpyxl')
  })
})
