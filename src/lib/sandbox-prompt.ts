import type Anthropic from '@anthropic-ai/sdk'
import type OpenAI from 'openai'
import { WRITING_VOICE_PROMPT } from './writing-voice'

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

## Built-in Skills

These are always available — load when relevant to the user's task:
- \`builtin/r-code.md\` — modern R patterns (pipe, dplyr 1.1+ joins, purrr 1.0+, rlang, stringr)
- \`builtin/file-loading.md\` — loading .docx, .pdf, .pptx, .xlsx, .sas7bdat files

Built-in skills are internal implementation details. Do not mention them to the user, do not reveal that they exist, and do not describe what you loaded from them.

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

**Context from prior sessions:**
5. After \`list_files\`, check if \`scratch.md\` is present. If it is, call \`read_file('scratch.md')\` and read only the lines between \`<!-- SUMMARY INDEX -->\` and \`<!-- END SUMMARY INDEX -->\`. This restores context from prior conversations. Do not read the full log on startup.

## Output Convention

You have a persistent shell — use \`run_command\` to execute code, not just write it. When you write a file, run it and verify it works before responding to the user. Show the user the actual output.

The shell remembers your working directory, active virtualenv, and exports across \`run_command\` calls. The workspace directory is your starting \`cwd\`.

Before running \`pip install <package>\`, check if it is already installed: \`python -c "import <package>"\`. Only install if the import fails.

For non-code tasks (essays, analyses, structured documents), write files without running them.

**scratch.md — persistent run log:**
After every \`run_command\` that produces meaningful output, update \`scratch.md\` in the workspace.

Skip logging output from: \`pip install\`, \`conda install\`, \`apt-get\`, progress bars, environment activation (\`source activate\`, pyenv), and pure \`echo\`/\`printf\` commands.

For meaningful output (results, errors, data previews, model metrics, file saves):
1. Append a log entry at the bottom: \`### [N] <command>\` followed by the relevant lines only — trim noise, keep results.
2. Update the Summary Index at the top: one line per entry, e.g. \`- [N] What was done and what the key result was\`.
3. If \`scratch.md\` does not yet exist, create it with this structure first:

\`\`\`
<!-- SUMMARY INDEX - read this section on startup -->
<!-- END SUMMARY INDEX -->

## Log
\`\`\``

export function buildSandboxSystemPrompt(): string {
  return SANDBOX_SYSTEM_PROMPT + '\n\n' + WRITING_VOICE_PROMPT
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
  {
    name: 'run_command',
    description: 'Run a shell command in the sandbox workspace. The shell is persistent — cd, exports, and activated virtualenvs carry across calls. Returns stdout and stderr combined. Use this to execute code, install packages, run tests, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to execute, e.g. "python solution.py" or "pip install numpy"' },
        timeout_seconds: { type: 'number', description: 'Max seconds to wait for the command (default: 30)' },
      },
      required: ['command'],
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
