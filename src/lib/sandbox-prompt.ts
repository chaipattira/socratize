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

You have a persistent shell — use \`run_command\` to execute code, not just write it. When you write a file, run it and verify it works before responding to the user. Show the user the actual output.

The shell remembers your working directory, active virtualenv, and exports across \`run_command\` calls. The workspace directory is your starting \`cwd\`.

For non-code tasks (essays, analyses, structured documents), write files without running them.`

const BASELINE_SKILLS_PROMPT = `## R Code Writing

When writing R code, follow these modern patterns:

### Core Principles
- Always use native pipe \`|>\` (not magrittr \`%>%\`)
- Profile before optimizing: use \`profvis\` for unknown bottlenecks, \`bench::mark()\` for comparing alternatives
- Write readable code first; optimize only when necessary

### Joins (dplyr 1.1+)
Use \`join_by()\` instead of character vectors. Supports inequality, rolling, and overlap joins.

\`\`\`r
# Modern join syntax
transactions |>
  inner_join(companies, by = join_by(company == id))

# Inequality join
transactions |>
  inner_join(companies, join_by(company == id, year >= since))

# Quality control
inner_join(x, y, by = join_by(id), multiple = "error")
inner_join(x, y, by = join_by(id), unmatched = "error")
\`\`\`

### Data Masking
Use \`{{}}\` (embrace) for function arguments; use \`.data[[]]\` for character vectors.

\`\`\`r
my_summary <- function(data, group_var, summary_var) {
  data |>
    group_by({{ group_var }}) |>
    summarise(mean_val = mean({{ summary_var }}))
}

for (var in names(mtcars)) {
  mtcars |> count(.data[[var]]) |> print()
}
\`\`\`

### Per-Operation Grouping (dplyr 1.1+)
Use \`.by\` instead of \`group_by()\` + \`ungroup()\` — always returns ungrouped.

\`\`\`r
data |> summarise(mean_value = mean(value), .by = category)
data |> reframe(quantiles = quantile(x, c(0.25, 0.5, 0.75)), .by = group)
data |> summarise(across(where(is.numeric), mean, .names = "mean_{.col}"), .by = group)
\`\`\`

### rlang Metaprogramming

| Operator | Use Case |
|----------|----------|
| \`{{ }}\` | Forward function arguments |
| \`!!\` | Inject single expression/value |
| \`!!!\` | Inject multiple arguments |
| \`.data[[]]\` | Access columns by name string |

\`\`\`r
# Name injection with glue syntax
my_mean <- function(data, var) {
  data |> dplyr::summarise("mean_{{ var }}" := mean({{ var }}))
}

# Pronouns for disambiguation
cyl <- 1000
mtcars |> dplyr::summarise(
  data_cyl = mean(.data$cyl),    # column value
  env_cyl  = mean(.env$cyl)      # local variable
)

# Splicing
vars <- c("cyl", "am")
mtcars |> dplyr::group_by(!!!syms(vars))
\`\`\`

Never use string eval — use \`sym()\` instead:
\`\`\`r
# Bad:
eval(parse(text = paste("mean(", var, ")")))

# Good:
!!sym(var)
\`\`\`

### purrr 1.0+
- \`map() |> list_rbind()\` replaces deprecated \`map_dfr()\`
- \`map() |> list_cbind()\` replaces deprecated \`map_dfc()\`
- Use \`walk()\` for side effects

### stringr (prefer over base R)

| Base R | stringr |
|--------|---------|
| \`grepl(pattern, x)\` | \`str_detect(x, pattern)\` |
| \`gsub(a, b, x)\` | \`str_replace_all(x, a, b)\` |
| \`tolower(x)\` | \`str_to_lower(x)\` |
| \`nchar(x)\` | \`str_length(x)\` |
| \`substr(x, 1, 5)\` | \`str_sub(x, 1, 5)\` |

### SAS Files
⚠️ When you see a \`.sas7bdat\` file, ALWAYS load it with R using haven::read_sas — never try to read it as raw text:

\`\`\`r
library(haven)
data <- haven::read_sas("file.sas7bdat")
\`\`\`

---

## File Loading

When a user uploads a binary file, a readable .txt companion file is automatically extracted and saved alongside it (e.g., \`report.docx\` → \`report.docx.txt\`).

**When a user refers to a \`.docx\`, \`.pdf\`, \`.pptx\`, or \`.xlsx\` file, always read the \`.txt\` companion — do not call \`read_file\` on the binary original.**

If the companion does not exist (extraction may have failed), use the manual extraction methods below via \`run_command\`.

For \`.sas7bdat\` files, no companion is auto-generated — always load with R (see SAS Files above).

### .docx (manual fallback if companion missing)
\`\`\`python
# pip install python-docx
from docx import Document
doc = Document("file.docx")
text = "\\n".join(p.text for p in doc.paragraphs if p.text.strip())
print(text)
\`\`\`

### .pdf (manual fallback if companion missing)
\`\`\`python
# pip install pypdf
from pypdf import PdfReader
reader = PdfReader("file.pdf")
for i, page in enumerate(reader.pages):
    text = page.extract_text() or ""
    if text.strip():
        print(f"--- Page {i+1} ---")
        print(text.strip())
\`\`\`

### .pptx (manual fallback if companion missing)
\`\`\`bash
pip install markitdown
python -m markitdown presentation.pptx
\`\`\`

### .xlsx (manual fallback if companion missing)
\`\`\`python
# pip install openpyxl
import openpyxl
wb = openpyxl.load_workbook("file.xlsx", read_only=True, data_only=True)
for sheet_name in wb.sheetnames:
    print(f"=== Sheet: {sheet_name} ===")
    ws = wb[sheet_name]
    for row in ws.iter_rows(values_only=True):
        print("\\t".join(str(v) if v is not None else "" for v in row))
\`\`\``

export function buildSandboxSystemPrompt(): string {
  return SANDBOX_SYSTEM_PROMPT + '\n\n' + BASELINE_SKILLS_PROMPT
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
