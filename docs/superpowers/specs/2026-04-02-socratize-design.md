# Socratize — Design Spec

## Context

Domain experts (professors, researchers) want to use AI agents in education but struggle to encode their knowledge into formats agents can use. The current workflow — generating a markdown skill file and asking the expert to edit it — fails because experts don't know what scope to edit, what to tell the LLM, or how to structure knowledge for agent consumption.

Socratize reverses this workflow. Instead of asking experts to write for agents, the platform interviews them using Socratic dialogue to extract tacit knowledge they may not be able to articulate unprompted, then automatically produces structured markdown knowledge files.

Inspired by [kevins981/Socratic](https://github.com/kevins981/Socratic) and built as a companion to [chaipattira/aix-copilot](https://github.com/chaipattira/aix-copilot).

## Users

**Primary user:** Domain experts in academia — professors across disciplines (epidemiology, chemistry, history, etc.) who want to create AI tutoring agents for their courses. Non-technical. No understanding of prompting, agent architectures, or markdown required.

**Usage model:** Expert works solo. No developer in the loop. The platform handles all knowledge structuring.

## What It Does

A webapp where domain experts have guided conversations with an LLM to extract their knowledge into downloadable markdown files suitable for any agent system.

### Core Experience

A split-pane interface:

- **Left pane — Chat.** The expert has a hybrid guided conversation with the LLM. The LLM provides structure (internally tracking extraction phases) but the expert can freely share knowledge. The LLM adaptively probes for gaps, edge cases, and tacit assumptions.
- **Right pane — Markdown editor.** Shows the actual markdown file being generated, updating live as knowledge is extracted. Monospace, syntax-highlighted, directly editable by the expert. Filename displayed in the pane header (e.g., `confounding.md`).

### Session Flow

1. **Sign up / Log in** — Google OAuth via NextAuth.js.
2. **Dashboard** — List of saved sessions. "New Session" button.
3. **New Session** — Expert enters a topic ("Confounding in Epidemiology"). The LLM opens with a contextual first question: "Tell me about [topic] — who are you teaching this to, and what do they need to walk away understanding?"
4. **Mid-session** — Hybrid guided conversation. The LLM probes, the expert shares, the markdown forms on the right. The expert can:
   - Chat naturally and let the document build itself
   - Edit the markdown directly in the right pane
   - Tell the LLM "that's not quite right" to trigger corrections
5. **Wrapping up** — The LLM says "I think we've covered the core of [topic]. Want me to probe deeper on anything, or does this look complete?"
6. **Export** — Click "Download .md" to get the raw markdown file.
7. **Resume** — Sessions auto-save after every exchange. Expert can return to any session from the dashboard.

## Extraction Engine

The LLM conducts the interview using a meta-prompt that defines extraction phases. The expert never sees phases — the conversation feels natural. The LLM auto-detects the knowledge type from conversation context and adapts its probing strategy.

### Internal Extraction Phases

1. **Scope & Context** — Establish topic, audience, level, learning objectives. Fills in the document header.
2. **Core Concepts** — Key ideas, definitions, relationships, prerequisites. The LLM asks for concrete examples when definitions are abstract.
3. **Procedures & Decision-Making** — Step-by-step workflows, decision trees, the expert's reasoning process. This is where tacit knowledge lives — the "I just know to check for X" moments.
4. **Misconceptions & Edge Cases** — What students always get wrong, subtle distinctions, cases where intuition fails. Often the most valuable knowledge.
5. **Validation** — The LLM reads back its understanding and asks the expert to correct it.

Phase transitions are fluid. If the expert mentions a misconception while explaining a concept, the LLM captures it immediately rather than deferring.

### Structured LLM Response Format

The LLM produces both a conversational reply and document edits. This is handled via **tool use** — the LLM's text response is the chat message (streamed live to the left pane), and it calls an `update_document` tool to modify the markdown.

Tool definition provided to the LLM:

```json
{
  "name": "update_document",
  "description": "Apply edits to the knowledge document",
  "parameters": {
    "ops": [
      { "op": "append", "section": "## Common Misconceptions", "content": "..." },
      { "op": "update", "section": "## Core Concepts", "find": "old text", "replace": "corrected text" },
      { "op": "insert_section", "after": "## Core Concepts", "content": "## Procedures\n\n..." },
      { "op": "replace_section", "section": "## Procedures", "content": "..." }
    ]
  }
}
```

Operations:
- `append` — Add content to the end of an existing section
- `update` — Find and replace text within a section
- `insert_section` — Insert a new section after a specified heading
- `replace_section` — Replace an entire section's content

The chat text streams in real-time to the left pane. Once the tool call completes, the frontend applies the document operations to the markdown in the right pane. This cleanly separates conversational output from structured edits using the LLM's native tool-calling capability.

### Meta-Prompt Design

The system prompt instructs the LLM to:
- Act as a knowledge extractor, not a tutor
- Ask one probing question at a time
- Probe for specifics when answers are vague ("Can you give me an example?", "What would a student actually do wrong here?")
- Surface tacit knowledge ("You said you 'just know' to check X — what's the underlying reasoning?")
- Detect the type of knowledge being shared (conceptual, procedural, decision framework) and adapt probing
- Always return both `chat` and `doc_ops` in the structured format
- Write the markdown document for an agent audience — clear, structured, actionable

## Technical Architecture

### Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Frontend:** React, CodeMirror (markdown editor), streaming chat UI
- **Backend:** Next.js API routes
- **Database:** SQLite via Prisma (migrateable to Postgres)
- **Auth:** NextAuth.js with Google OAuth
- **LLM:** BYOK (Bring Your Own Key) — supports Claude and OpenAI. API keys encrypted in database.
- **Deployment:** Vercel + Turso (hosted SQLite)

### Data Model

```
User {
  id          String    @id
  email       String    @unique
  name        String?
  sessions    Session[]
  apiKeys     ApiKey[]
  createdAt   DateTime
}

Session {
  id              String    @id
  userId          String
  title           String
  markdownContent String    // current state of the document
  llmProvider     String    // "anthropic" | "openai"
  model           String    // "claude-sonnet-4-5-20250514" | "gpt-4o" etc.
  messages        Message[]
  createdAt       DateTime
  updatedAt       DateTime
}

Message {
  id        String   @id
  sessionId String
  role      String   // "user" | "assistant" | "system"
  content   String   // raw message content
  docOps    String?  // JSON of document operations (assistant messages only)
  createdAt DateTime
}

ApiKey {
  id           String  @id
  userId       String
  provider     String  // "anthropic" | "openai"
  encryptedKey String
}
```

### API Routes

- `POST /api/auth/[...nextauth]` — Authentication
- `GET /api/sessions` — List user's sessions
- `POST /api/sessions` — Create new session
- `GET /api/sessions/[id]` — Get session with messages and document
- `DELETE /api/sessions/[id]` — Delete session
- `POST /api/chat` — Send message, proxy to LLM, stream response. Accepts `{ sessionId, message }`. Appends the user message and assistant response to the database. Parses `doc_ops` from the response and updates `session.markdownContent`.
- `PUT /api/sessions/[id]/document` — Direct markdown edits from the right pane
- `GET /api/sessions/[id]/export` — Download markdown file
- `POST /api/keys` — Save encrypted API key
- `DELETE /api/keys/[id]` — Remove API key

### Key Data Flows

**Chat exchange:**
```
User sends message
  → POST /api/chat { sessionId, message }
  → Server loads session context (system prompt + message history + current document)
  → Server calls LLM API with user's API key (streaming, with update_document tool)
  → Text chunks streamed to frontend via SSE → displayed in left pane
  → Tool call (update_document) arrives after text → frontend applies ops to markdown
  → Server saves message + tool call result + updated markdownContent to DB
```

**Direct markdown edit:**
```
Expert edits markdown in right pane
  → PUT /api/sessions/[id]/document { markdownContent }
  → Server saves to DB
  → Next LLM call includes updated document as context
```

**Session resume:**
```
Expert clicks session in dashboard
  → GET /api/sessions/[id]
  → Returns messages + markdownContent
  → Frontend restores chat history and markdown state
  → Expert continues conversation
```

## Verification

1. **Session creation:** Create a new session, verify the LLM asks a contextual opening question and the markdown pane shows the document header forming.
2. **Knowledge extraction:** Have a multi-turn conversation about a topic. Verify the markdown document populates with structured content across sections.
3. **Direct editing:** Edit the markdown in the right pane. Send another chat message. Verify the LLM's next response is aware of the manual edit.
4. **Session persistence:** Close the browser, reopen, resume the session. Verify conversation history and markdown state are restored.
5. **Export:** Download the markdown file. Open it in a text editor. Verify it's clean, well-structured markdown.
6. **BYOK:** Test with both Anthropic and OpenAI API keys. Verify both work for extraction.
