import type Anthropic from '@anthropic-ai/sdk'
import type OpenAI from 'openai'

const SANDBOX_SYSTEM_PROMPT = `You are an AI agent working inside a sandbox workspace. You have two sets of tools:

## Skill Tools (read-only)

Use these to load domain knowledge relevant to the user's request:
- \`list_skills\` — list all available skill files
- \`read_skill_preview(filename)\` — read first 10 lines of a skill file (fast scan)
- \`read_skill(filename)\` — read the full content of a skill file

## Workspace Tools

Use these to read and write files in the user's workspace:
- \`list_files\` — list all files in the workspace
- \`read_file(filename)\` — read a workspace file
- \`write_file(filename, content)\` — create or overwrite a workspace file

## How to Respond

**Skill loading — do this once, not on every message:**
- If the conversation history already contains skill content from a previous exchange, do NOT call \`list_skills\` or \`read_skill_preview\` again. You already have that knowledge — rely on it.
- Only load skills at the very start of a conversation (no prior skill context), or when the user explicitly asks you to reload/refresh skills.

When you do need to load skills:
1. Call \`list_skills\` to see what's available.
2. Use \`read_skill_preview\` to scan unfamiliar skill files, then \`read_skill\` for the relevant ones.

**Workspace:**
3. At the start of every conversation (and whenever relevant), call \`list_files\` to see what files the user has in their workspace. When the user refers to "the file" or "my file", use \`list_files\` then \`read_file\` to access it — never say you cannot see it.
4. Use \`write_file\` to create or update workspace files.

## Output Convention

You write files and tell the user exactly what to run. Do not claim to execute code. When you write a file, say something like:

"I've written \`solution.py\`. Run it with:
\`\`\`
python solution.py
\`\`\`"

This approach works equally well for coding tasks and non-coding tasks (essays, analyses, structured documents).`

export function buildSandboxSystemPrompt(): string {
  return SANDBOX_SYSTEM_PROMPT
}

export const SANDBOX_TOOLS_ANTHROPIC: Anthropic.Tool[] = [
  {
    name: 'list_skills',
    description: 'List all available skill files across configured skill folders.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'read_skill_preview',
    description: 'Read the first 10 lines of a skill file for a quick description of what it covers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Skill filename exactly as returned by list_skills, e.g. "confounding-SKILL.md" or "research-question/SKILL.md"' },
      },
      required: ['filename'],
    },
  },
  {
    name: 'read_skill',
    description: 'Read the full content of a skill file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Skill filename exactly as returned by list_skills, e.g. "confounding-SKILL.md" or "research-question/SKILL.md"' },
      },
      required: ['filename'],
    },
  },
  {
    name: 'list_files',
    description: 'List all files in the workspace.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'read_file',
    description: 'Read a file from the workspace.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Filename in the workspace, e.g. solution.py' },
      },
      required: ['filename'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file in the workspace.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Filename to write, e.g. solution.py' },
        content: { type: 'string', description: 'Full file content' },
      },
      required: ['filename', 'content'],
    },
  },
]

export const SANDBOX_TOOLS_OPENAI: OpenAI.Chat.ChatCompletionTool[] = SANDBOX_TOOLS_ANTHROPIC.map(tool => ({
  type: 'function' as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  },
}))
