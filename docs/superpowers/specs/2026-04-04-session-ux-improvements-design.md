# Session UX Improvements — Design Spec

**Date:** 2026-04-04

## Overview

Four fixes and features improve the session experience: eliminate a double-response bug on session start, give the build phase awareness of existing skill files, change the keyboard shortcut for sending messages, and inject editor selections into chat.

---

## 1. Fix: Double Response on Session Start

### Problem

Next.js 13+ enables React StrictMode by default in development. StrictMode mounts, unmounts, and remounts components to surface side effects. The `useEffect` in `SessionView.tsx` that triggers `triggerBuildPhase()` or `triggerKbSession()` fires twice as a result, producing two API calls and two responses.

### Fix

Add a `useRef` guard at the top of `SessionView`:

```ts
const hasAutoTriggered = useRef(false)
useEffect(() => {
  if (hasAutoTriggered.current) return
  hasAutoTriggered.current = true
  if (extractionMode === 'socratize' && initialMessages.length === 0) {
    triggerBuildPhase()
  } else if (isKbSession && extractionMode !== 'socratize_eval' && initialMessages.length === 0) {
    triggerKbSession()
  }
}, []) // intentionally runs once on mount
```

**Files:** `src/components/SessionView.tsx`

---

## 2. Build Phase: List and Read Existing Files on Start

### Problem

The build (socratize) phase has only one tool: `write_skill_file`. It cannot read existing skill files in the folder. When a user reopens a build session or a folder already contains SKILL.md files, the LLM starts blind — it doesn't know what already exists.

### Design

Refactor the socratize route from simple streaming to an agentic tool loop, matching the pattern in `chat/route.ts` (`runAnthropicKbLoop`). Add `list_files` and `read_file` tools alongside `write_skill_file`.

**Tools available in the build phase after this change:**

| Tool | Purpose |
|------|---------|
| `list_files` | List all `*-SKILL.md` files in the folder |
| `read_file` | Read the content of a specific skill file |
| `write_skill_file` | Write or overwrite a named SKILL.md file |

The system prompt gains an instruction to start each session by calling `list_files`, then `read_file` on each existing file, before engaging the user.

The route emits `tool_call` and `tool_result` SSE events so the chat UI displays the file reads as it already does for KB sessions.

**Files:** `src/app/api/sessions/[id]/socratize/route.ts`, `src/lib/socratize-prompt.ts`

---

## 3. Keyboard Shortcut: Enter to Send, Shift+Enter for Newline

### Current behavior

`Mod-Enter` (Cmd/Ctrl+Enter) submits. `Enter` inserts a newline (CodeMirror default).

### New behavior

- `Enter` → submit
- `Shift-Enter` → insert newline

### Implementation

Update the CodeMirror `keymap` extension in `ChatPane.tsx`. Declare `Shift-Enter` before `Enter` so CodeMirror evaluates it first:

```ts
import { insertNewlineAndIndent } from '@codemirror/commands'

keymap.of([
  { key: 'Shift-Enter', run: insertNewlineAndIndent },
  { key: 'Enter', run: () => { submitRef.current(); return true } },
])
```

**Files:** `src/components/ChatPane.tsx`

---

## 4. Editor Selection Injected into Chat Message

### Goal

When the user selects text in the EditorPane, that text is automatically included as context in the next message sent to the backend.

### UX

A dismissable quote chip appears above the chat input whenever text is selected in the editor. The chip shows a truncated preview of the selection. When the user sends a message, the backend receives:

```
> {selected text}

{user's typed message}
```

The chip clears after send. The user can also dismiss it manually by clicking ×.

### Data flow

1. `EditorPane` gains `onSelectionChange?: (text: string) => void`. A `EditorView.updateListener` extension calls this whenever the selection changes (empty string when deselected).
2. `SessionView` adds `editorSelection` state. It passes `onSelectionChange` to `EditorPane` and `quotedText={editorSelection}` to `ChatPane`.
3. `ChatPane` gains `quotedText?: string`. It renders the dismissable chip above the input when `quotedText` is non-empty. `handleSubmit` prepends the quote block to the message content before calling `onSend`.

### Quote chip behavior

- Appears above the chat input area when a selection is active
- Shows up to 120 characters of the selection with "..." if truncated
- Has an × button that clears the chip without affecting the editor's selection state
- Clears automatically after the user sends a message

`SessionView` maintains two separate pieces of state: `editorSelection` (the raw text from the listener) and `activeQuote` (what the chip shows). A new selection sets `activeQuote`. Clicking × sets `activeQuote` to `''`. After send, `activeQuote` resets to `''`. This avoids any need to imperatively manipulate the editor's selection.

**Files:** `src/components/EditorPane.tsx`, `src/components/SessionView.tsx`, `src/components/ChatPane.tsx`

---

## Architecture Impact

No database changes. No new dependencies. The `@codemirror/commands` package is already available (it ships with `@uiw/react-codemirror`).

The socratize route's refactor to an agentic loop adds complexity but follows an established pattern already in `chat/route.ts`. The tool execution logic for `list_files` and `read_file` can reuse `executeKbTool` from that file — extract it to `src/lib/kb-tools.ts` or duplicate the two handlers inline.
