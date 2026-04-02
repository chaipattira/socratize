import { describe, it, expect } from 'vitest'
import { KB_TOOLS_ANTHROPIC, KB_TOOLS_OPENAI } from '@/lib/kb-tools'

describe('KB_TOOLS_ANTHROPIC', () => {
  it('has four tools with correct names', () => {
    const names = KB_TOOLS_ANTHROPIC.map(t => t.name)
    expect(names).toContain('list_files')
    expect(names).toContain('read_file')
    expect(names).toContain('update_file')
    expect(names).toContain('create_file')
  })

  it('list_files has no required properties', () => {
    const tool = KB_TOOLS_ANTHROPIC.find(t => t.name === 'list_files')!
    expect(tool.input_schema.required ?? []).toHaveLength(0)
  })

  it('read_file requires filename', () => {
    const tool = KB_TOOLS_ANTHROPIC.find(t => t.name === 'read_file')!
    expect(tool.input_schema.required).toContain('filename')
  })

  it('update_file requires filename and ops', () => {
    const tool = KB_TOOLS_ANTHROPIC.find(t => t.name === 'update_file')!
    expect(tool.input_schema.required).toContain('filename')
    expect(tool.input_schema.required).toContain('ops')
  })

  it('create_file requires filename and content', () => {
    const tool = KB_TOOLS_ANTHROPIC.find(t => t.name === 'create_file')!
    expect(tool.input_schema.required).toContain('filename')
    expect(tool.input_schema.required).toContain('content')
  })
})

describe('KB_TOOLS_OPENAI', () => {
  it('has OpenAI function format', () => {
    expect(KB_TOOLS_OPENAI.every(t => t.type === 'function')).toBe(true)
    const names = KB_TOOLS_OPENAI.map(t => t.function.name)
    expect(names).toContain('list_files')
    expect(names).toContain('read_file')
    expect(names).toContain('update_file')
    expect(names).toContain('create_file')
  })
})
