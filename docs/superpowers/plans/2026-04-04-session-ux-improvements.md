# Session UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a double-response bug on session start, add list/read tools to the build phase, change Enter to send (Shift+Enter for newline), and inject editor text selections into the chat input.

**Architecture:** Four independent changes touching `SessionView`, `ChatPane`, `EditorPane`, and the socratize API route. The most complex change refactors the socratize route from a simple streaming loop to a multi-turn agentic tool loop (same pattern as `chat/route.ts`), adding `list_files` and `read_file` alongside the existing `write_skill_file` tool. The selection injection adds a reactive data flow: EditorPane → SessionView → ChatPane, with a dismissable quote chip in the chat UI.

**Tech Stack:** Next.js 15, React 18, `@codemirror/view`, `@codemirror/commands`, `@uiw/react-codemirror`, Anthropic SDK, OpenAI SDK, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `src/components/SessionView.tsx` | Add `useRef` trigger guard; add `editorSelection`/`activeQuote` state; wire EditorPane → ChatPane |
| `src/components/ChatPane.tsx` | Change keymap to Enter=send / Shift+Enter=newline; add quote chip UI |
| `src/components/EditorPane.tsx` | Add `onSelectionChange` prop + `EditorView.updateListener` extension |
| `src/lib/socratize-prompt.ts` | Add `list_files` + `read_file` tool definitions; update system prompt |
| `src/app/api/sessions/[id]/socratize/route.ts` | Refactor to agentic tool loop; handle `list_files`, `read_file`, `write_skill_file` |

---

## Task 1: Fix double-trigger on session mount

**Files:**
- Modify: `src/components/SessionView.tsx`

- [ ] **Step 1: Add `useRef` guard to the auto-trigger effect**

In `src/components/SessionView.tsx`, find the `useEffect` that calls `triggerBuildPhase()` or `triggerKbSession()`. Add a ref guard immediately before it:

```tsx
// Add this ref just before the useEffect (around line 87)
const hasAutoTriggered = useRef(false)

useEffect(() => {
  if (hasAutoTriggered.current) return
  hasAutoTriggered.current = true
  if (extractionMode === 'socratize' && initialMessages.length === 0) {
    triggerBuildPhase()
  } else if (isKbSession && extractionMode !== 'socratize_eval' && initialMessages.length === 0) {
    triggerKbSession()
  }
  // socratize_eval: no auto-trigger — user sends the first test prompt
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []) // intentionally runs once on mount
```

`useRef` is already imported at the top of the file.

- [ ] **Step 2: Verify manually**

Open a new socratize or KB session. Confirm the assistant greets only once. Open DevTools Network tab — only one POST to `/api/sessions/.../socratize` or `/api/chat`.

- [ ] **Step 3: Commit**

```bash
git add src/components/SessionView.tsx
git commit -m "fix: prevent double auto-trigger on session mount in StrictMode"
```

---

## Task 2: Change chat keyboard shortcuts — Enter sends, Shift+Enter inserts newline

**Files:**
- Modify: `src/components/ChatPane.tsx`

- [ ] **Step 1: Import `insertNewlineAndIndent`**

At the top of `src/components/ChatPane.tsx`, update the import from `@codemirror/view`:

```ts
import { EditorView, keymap } from '@codemirror/view'
```

Add a new import line below it:

```ts
import { insertNewlineAndIndent } from '@codemirror/commands'
```

- [ ] **Step 2: Update the keymap extension**

In the `useMemo` for `extensions` (around line 98), replace the existing `keymap.of(...)` entry:

```ts
// Before:
keymap.of([{
  key: 'Mod-Enter',
  run: () => { submitRef.current(); return true },
}]),

// After:
keymap.of([
  { key: 'Shift-Enter', run: insertNewlineAndIndent },
  { key: 'Enter', run: () => { submitRef.current(); return true } },
]),
```

Order matters: Shift+Enter must appear before Enter so CodeMirror tests it first.

- [ ] **Step 3: Verify manually**

Load any session. In the chat input:
- Press Enter → message sends (input clears)
- Press Shift+Enter → newline inserted, no send

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatPane.tsx
git commit -m "feat: Enter sends message, Shift+Enter inserts newline in chat input"
```

---

## Task 3: Add list/read tool definitions and update socratize system prompt

**Files:**
- Modify: `src/lib/socratize-prompt.ts`

- [ ] **Step 1: Add tool definitions for `list_files` and `read_file`**

Append these exports to `src/lib/socratize-prompt.ts` after the existing `WRITE_SKILL_FILE_TOOL_OPENAI` export:

```ts
export const LIST_FILES_TOOL = {
  name: 'list_files',
  description: 'List all skill files (*-SKILL.md) already in the knowledge folder.',
  input_schema: { type: 'object' as const, properties: {}, required: [] },
}

export const READ_FILE_TOOL = {
  name: 'read_file',
  description: 'Read the full content of an existing skill file.',
  input_schema: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string', description: 'Filename, e.g. code-review-SKILL.md' },
    },
    required: ['filename'],
  },
}

export const SOCRATIZE_TOOLS_ANTHROPIC = [LIST_FILES_TOOL, READ_FILE_TOOL, WRITE_SKILL_FILE_TOOL]

export const SOCRATIZE_TOOLS_OPENAI = [
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: LIST_FILES_TOOL.description,
      parameters: LIST_FILES_TOOL.input_schema,
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: READ_FILE_TOOL.description,
      parameters: READ_FILE_TOOL.input_schema,
    },
  },
  WRITE_SKILL_FILE_TOOL_OPENAI,
]
```

- [ ] **Step 2: Update the system prompt to read files on session start**

In `src/lib/socratize-prompt.ts`, add a new section at the top of `SOCRATIZE_BUILD_PROMPT`, before the `## About Skill Files` section:

```ts
const SOCRATIZE_BUILD_PROMPT = `You are a skill architect. Your job is to interview the user about their expertise and, through conversation, write skill files that capture what they know.

## Starting a Session

Before greeting the user, call \`list_files\` to see what skill files already exist in the folder, then call \`read_file\` for each one. If files exist, acknowledge them and ask whether the user wants to refine an existing skill or create a new one. If the folder is empty, proceed with the interview.

## About Skill Files
...
```

(Keep all existing content after the new section intact.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/socratize-prompt.ts
git commit -m "feat: add list_files + read_file tools to socratize and update system prompt"
```

---

## Task 4: Refactor socratize route to agentic tool loop

**Files:**
- Modify: `src/app/api/sessions/[id]/socratize/route.ts`

- [ ] **Step 1: Update imports**

Replace the existing imports at the top of the route with:

```ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import {
  buildSocratizeSystemPrompt,
  buildSocratizeMessages,
  SOCRATIZE_TOOLS_ANTHROPIC,
  SOCRATIZE_TOOLS_OPENAI,
  type SocratizeMessage,
} from '@/lib/socratize-prompt'
import { validateSkillFilename, writeKbFile, readKbFile, listFiles } from '@/lib/knowledge-base'
```

- [ ] **Step 2: Add `executeSocratizeTool` helper**

Add this function before the `POST` handler:

```ts
function executeSocratizeTool(
  name: string,
  input: Record<string, unknown>,
  folderPath: string
): { result: string; fileUpdate?: { filename: string; content: string } } {
  if (name === 'list_files') {
    const files = listFiles(folderPath)
    return { result: files.length > 0 ? files.join('\n') : '(no files yet)' }
  }
  if (name === 'read_file') {
    const filename = input.filename as string
    if (!validateSkillFilename(filename)) return { result: 'Error: invalid skill filename' }
    try {
      return { result: readKbFile(folderPath, filename) }
    } catch {
      return { result: `Error: file "${filename}" not found` }
    }
  }
  if (name === 'write_skill_file') {
    const filename = input.filename as string
    const content = input.content as string
    if (!validateSkillFilename(filename)) return { result: 'Error: invalid skill filename' }
    try {
      writeKbFile(folderPath, filename, content)
      return { result: 'ok', fileUpdate: { filename, content } }
    } catch (e) {
      return { result: `Error: ${String(e)}` }
    }
  }
  return { result: 'Error: unknown tool' }
}
```

- [ ] **Step 3: Add `runAnthropicSocratizeLoop` function**

Add this function after `executeSocratizeTool`:

```ts
async function runAnthropicSocratizeLoop(
  anthropic: Anthropic,
  model: string,
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  folderPath: string,
  send: (data: object) => void
): Promise<string> {
  const loopMessages: Anthropic.MessageParam[] = [...messages]
  let fullText = ''

  while (true) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: SOCRATIZE_TOOLS_ANTHROPIC as any,
      messages: loopMessages,
    })

    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

    for (const block of response.content) {
      if (block.type === 'text') {
        fullText += block.text
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> })
      }
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        send({ type: 'tool_call', name: toolUse.name, input: toolUse.input })
        const { result, fileUpdate } = executeSocratizeTool(toolUse.name, toolUse.input, folderPath)
        if (fileUpdate) {
          send({ type: 'file_update', filename: fileUpdate.filename, content: fileUpdate.content })
        }
        send({ type: 'tool_result', name: toolUse.name, success: !result.startsWith('Error') })
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
      }

      loopMessages.push({ role: 'assistant', content: response.content })
      loopMessages.push({ role: 'user', content: toolResults })
    } else {
      send({ type: 'text', delta: fullText })
      break
    }
  }

  return fullText
}
```

- [ ] **Step 4: Add `runOpenAISocratizeLoop` function**

Add this function after `runAnthropicSocratizeLoop`:

```ts
async function runOpenAISocratizeLoop(
  openai: OpenAI,
  model: string,
  systemPrompt: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  folderPath: string,
  send: (data: object) => void
): Promise<string> {
  type OAIMessage = OpenAI.Chat.ChatCompletionMessageParam
  const loopMessages: OAIMessage[] = [{ role: 'system', content: systemPrompt }, ...messages]
  let fullText = ''

  while (true) {
    const response = await openai.chat.completions.create({
      model,
      tools: SOCRATIZE_TOOLS_OPENAI,
      messages: loopMessages,
    })

    const choice = response.choices[0]
    const message = choice.message

    if (choice.finish_reason === 'tool_calls' && message.tool_calls) {
      const toolResults: OAIMessage[] = []

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') continue
        const name = toolCall.function.name
        const input = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
        send({ type: 'tool_call', name, input })
        const { result, fileUpdate } = executeSocratizeTool(name, input, folderPath)
        if (fileUpdate) {
          send({ type: 'file_update', filename: fileUpdate.filename, content: fileUpdate.content })
        }
        send({ type: 'tool_result', name, success: !result.startsWith('Error') })
        toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: result })
      }

      loopMessages.push(message)
      loopMessages.push(...toolResults)
    } else {
      fullText = message.content ?? ''
      send({ type: 'text', delta: fullText })
      break
    }
  }

  return fullText
}
```

- [ ] **Step 5: Replace the `POST` handler body**

Replace everything inside the `stream`'s `start(controller)` function with:

```ts
async start(controller) {
  const send = (data: object) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  try {
    const decryptedKey = decrypt(apiKeyRecord.encryptedKey)
    const systemPrompt = buildSocratizeSystemPrompt()
    const messages = buildSocratizeMessages(session.title, followUps as SocratizeMessage[])

    if (apiKeyRecord.provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey: decryptedKey })
      await runAnthropicSocratizeLoop(
        anthropic, session.model, systemPrompt,
        messages as Anthropic.MessageParam[],
        session.knowledgeFolderPath!, send
      )
    } else {
      const openai = new OpenAI({ apiKey: decryptedKey })
      await runOpenAISocratizeLoop(
        openai, session.model, systemPrompt,
        messages as OpenAI.Chat.ChatCompletionMessageParam[],
        session.knowledgeFolderPath!, send
      )
    }

    send({ type: 'done' })
  } catch (err) {
    console.error('[socratize] Error:', err)
    const is401 = err instanceof Error && (err as any).status === 401
    send({
      type: 'error',
      message: is401
        ? 'Invalid API key. Check your key in Settings.'
        : 'An error occurred. Please try again.',
    })
  } finally {
    controller.close()
  }
},
```

- [ ] **Step 6: Verify manually**

Start a new build session. Confirm:
- The chat shows "List Files" and "Read File" tool call indicators before the first message
- The assistant's greeting reflects whether files exist or not
- Subsequent follow-up turns work normally

- [ ] **Step 7: Commit**

```bash
git add src/app/api/sessions/[id]/socratize/route.ts src/lib/socratize-prompt.ts
git commit -m "feat: add list_files + read_file tools to build phase with agentic loop"
```

---

## Task 5: Add selection listener to EditorPane

**Files:**
- Modify: `src/components/EditorPane.tsx`

- [ ] **Step 1: Add `onSelectionChange` prop to the interface**

In `src/components/EditorPane.tsx`, update `EditorPaneProps`:

```ts
interface EditorPaneProps {
  filename: string
  content: string
  onChange: (value: string) => void
  onDownload: () => void
  files?: string[]
  onFileClick?: (filename: string) => void
  activeFilename?: string
  onSelectionChange?: (text: string) => void  // new
}
```

Update the destructured parameter list in `EditorPane`:

```ts
export function EditorPane({
  filename,
  content,
  onChange,
  onDownload,
  files,
  onFileClick,
  activeFilename,
  onSelectionChange,  // new
}: EditorPaneProps) {
```

- [ ] **Step 2: Add `useCallback` import**

`useCallback` is not yet imported in EditorPane. Update the React import:

```ts
import { useCallback, useMemo } from 'react'
```

- [ ] **Step 3: Build the selection listener extension**

Add a `useMemo` for the extensions array after the existing imports in the `EditorPane` function body. The extensions array is currently inline in the `<CodeMirror>` JSX. Replace it with a memoized version that includes the listener:

```ts
const extensions = useMemo(() => {
  const base = [markdown(), EditorView.lineWrapping]
  if (!onSelectionChange) return base
  return [
    ...base,
    EditorView.updateListener.of(update => {
      if (!update.selectionSet) return
      const sel = update.state.selection.main
      if (sel.empty) {
        onSelectionChange('')
      } else {
        onSelectionChange(update.state.doc.sliceString(sel.from, sel.to))
      }
    }),
  ]
}, [onSelectionChange])
```

Then pass `extensions={extensions}` to the `<CodeMirror>` inside the main editor area (replace the inline `extensions={[markdown(), EditorView.lineWrapping]}`).

- [ ] **Step 4: Commit**

```bash
git add src/components/EditorPane.tsx
git commit -m "feat: add onSelectionChange listener to EditorPane"
```

---

## Task 6: Wire selection state in SessionView

**Files:**
- Modify: `src/components/SessionView.tsx`

- [ ] **Step 1: Add `editorSelection` and `activeQuote` state**

After the existing state declarations in `SessionView`, add:

```ts
const [activeQuote, setActiveQuote] = useState('')
```

- [ ] **Step 2: Add `handleSelectionChange` callback**

Add this callback after `handleFileClick`:

```ts
const handleSelectionChange = useCallback((text: string) => {
  if (text) setActiveQuote(text)
}, [])

const handleClearQuote = useCallback(() => {
  setActiveQuote('')
}, [])
```

- [ ] **Step 3: Pass `onSelectionChange` to `EditorPane`**

In the JSX, update the `<EditorPane>` call to add:

```tsx
onSelectionChange={handleSelectionChange}
```

- [ ] **Step 4: Pass `quotedText` and `onClearQuote` to `ChatPane`**

Update the `<ChatPane>` call to add:

```tsx
quotedText={activeQuote}
onClearQuote={handleClearQuote}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionView.tsx
git commit -m "feat: wire editor selection state from EditorPane to ChatPane via SessionView"
```

---

## Task 7: Add quote chip to ChatPane

**Files:**
- Modify: `src/components/ChatPane.tsx`

- [ ] **Step 1: Add `quotedText` and `onClearQuote` to `ChatPaneProps`**

```ts
interface ChatPaneProps {
  // ... existing props ...
  quotedText?: string
  onClearQuote?: () => void
}
```

Add them to the destructured parameters:

```ts
export function ChatPane({
  // ... existing ...
  quotedText,
  onClearQuote,
}: ChatPaneProps) {
```

- [ ] **Step 2: Update `handleSubmit` to prepend the quote**

Replace the existing `handleSubmit`:

```ts
const handleSubmit = useCallback(() => {
  if (!input.trim() || isStreaming) return
  if (phase === 'testing' && !selectedSkillFile) return
  const body = quotedText
    ? `> ${quotedText.split('\n').join('\n> ')}\n\n${input.trim()}`
    : input.trim()
  onSend(body)
  setInput('')
  onClearQuote?.()
}, [input, isStreaming, phase, selectedSkillFile, onSend, quotedText, onClearQuote])
```

- [ ] **Step 3: Render the dismissable quote chip**

In the JSX, add the chip inside the bottom input area, just above the `<div className="flex gap-2 items-end">` that wraps the CodeMirror and Send button:

```tsx
{quotedText && (
  <div className="mb-2 flex items-start gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400">
    <span className="shrink-0 text-gray-600">›</span>
    <span className="flex-1 line-clamp-2 leading-relaxed">
      {quotedText.length > 120 ? `${quotedText.slice(0, 120)}…` : quotedText}
    </span>
    <button
      onClick={onClearQuote}
      className="shrink-0 text-gray-600 hover:text-gray-300 transition"
      aria-label="Clear quote"
    >
      ×
    </button>
  </div>
)}
```

- [ ] **Step 4: Verify manually**

Open a session with a file in the editor. Select some text in the EditorPane. Confirm:
- The quote chip appears above the chat input with the selected text
- The × button dismisses the chip
- Typing a message and pressing Enter sends `> [selection]\n\n[message]` (verify in the chat bubble that the selection appears as a blockquote)
- After send, the chip clears

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatPane.tsx
git commit -m "feat: quote chip in chat input injects editor selection into sent message"
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: double-response bug fixed with `useRef` guard
- ✅ Tasks 3–4: build phase gains `list_files` + `read_file` tools; route refactored to agentic loop; system prompt updated
- ✅ Task 2: Enter sends, Shift+Enter inserts newline
- ✅ Tasks 5–7: EditorPane reports selection → SessionView holds `activeQuote` → ChatPane renders chip and prepends blockquote on send

**Type consistency:**
- `onSelectionChange: (text: string) => void` — consistent across EditorPane prop definition, SessionView's `handleSelectionChange`, and the listener in `EditorView.updateListener.of`
- `quotedText` and `onClearQuote` — consistent between SessionView JSX and ChatPane prop interface
- `SOCRATIZE_TOOLS_ANTHROPIC` / `SOCRATIZE_TOOLS_OPENAI` — defined in socratize-prompt.ts, imported in route.ts

**Potential issue noted:** `useMemo` is added to EditorPane but may not currently be imported. Step 5.2 adds that import explicitly.
