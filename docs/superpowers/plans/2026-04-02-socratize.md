# Socratize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a webapp where domain experts chat with an LLM to extract their tacit knowledge into downloadable markdown files for AI agents.

**Architecture:** Next.js App Router + TypeScript full-stack. Split-pane UI: chat left, live markdown editor right. LLM uses tool calling to simultaneously respond conversationally and emit structured document edits, streamed over SSE.

**Tech Stack:** Next.js 14, TypeScript, Prisma + SQLite, NextAuth v4 (Google OAuth), Tailwind CSS, `@uiw/react-codemirror`, Anthropic SDK, OpenAI SDK, Vitest

---

## File Map

```
socratize/
├── prisma/
│   └── schema.prisma              # Full data model incl. NextAuth tables
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with SessionProvider
│   │   ├── page.tsx               # Redirect to /dashboard
│   │   ├── login/page.tsx         # Sign-in page
│   │   ├── dashboard/page.tsx     # Session list + new session dialog
│   │   ├── sessions/[id]/page.tsx # Split-pane session view
│   │   ├── settings/page.tsx      # API key management
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── chat/route.ts       # Streaming LLM proxy
│   │       ├── sessions/
│   │       │   ├── route.ts        # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts    # GET, DELETE
│   │       │       ├── document/route.ts  # PUT direct edit
│   │       │       └── export/route.ts    # GET download
│   │       └── keys/
│   │           ├── route.ts        # POST save key
│   │           └── [id]/route.ts   # DELETE
│   ├── components/
│   │   ├── ChatPane.tsx            # Left pane: message list + input
│   │   ├── EditorPane.tsx          # Right pane: CodeMirror + header
│   │   ├── SessionView.tsx         # Split-pane layout
│   │   ├── SessionCard.tsx         # Dashboard session card
│   │   └── NewSessionDialog.tsx    # Topic input modal
│   ├── hooks/
│   │   └── useChat.ts             # SSE stream consumer + state
│   └── lib/
│       ├── prisma.ts              # Prisma client singleton
│       ├── auth.ts                # NextAuth config
│       ├── encryption.ts          # AES-256-GCM for API keys
│       ├── doc-ops.ts             # Pure: apply doc operations to markdown
│       └── extraction-prompt.ts   # System prompt + update_document tool def
├── tests/
│   ├── lib/
│   │   ├── encryption.test.ts
│   │   ├── doc-ops.test.ts
│   │   └── extraction-prompt.test.ts
│   └── setup.ts
└── vitest.config.ts
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `.env.local`
- Create: `.gitignore` addition

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/chaipat/socratize
npx create-next-app@14 . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint
```

When prompted, answer: Yes to all defaults.

- [ ] **Step 2: Install dependencies**

```bash
npm install @prisma/client prisma next-auth @auth/prisma-adapter \
  @anthropic-ai/sdk openai \
  @uiw/react-codemirror @codemirror/lang-markdown @codemirror/theme-one-dark
npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Create test setup file**

```typescript
// tests/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Create .env.local**

```bash
# .env.local
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production-min-32-chars"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

`ENCRYPTION_KEY` must be exactly 64 hex chars (32 bytes). Generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] **Step 7: Initialize Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 8: Verify test runner works**

```bash
npm test
```

Expected: `No test files found` (or 0 tests passed). No errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: bootstrap Next.js project with Prisma and Vitest"
```

---

## Task 2: Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace schema.prisma with full data model**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// NextAuth required tables
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Application tables
model User {
  id            String          @id @default(cuid())
  email         String          @unique
  name          String?
  image         String?
  emailVerified DateTime?
  accounts      Account[]
  sessions      Session[]
  chatSessions  ChatSession[]
  apiKeys       ApiKey[]
  createdAt     DateTime        @default(now())
}

model ChatSession {
  id              String    @id @default(cuid())
  userId          String
  title           String
  markdownContent String    @default("")
  llmProvider     String    @default("anthropic")
  model           String    @default("claude-sonnet-4-5-20250514")
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages        Message[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Message {
  id            String      @id @default(cuid())
  chatSessionId String
  role          String      // "user" | "assistant"
  content       String
  docOps        String?     // JSON string of DocOp[]
  chatSession   ChatSession @relation(fields: [chatSessionId], references: [id], onDelete: Cascade)
  createdAt     DateTime    @default(now())
}

model ApiKey {
  id           String  @id @default(cuid())
  userId       String
  provider     String  // "anthropic" | "openai"
  encryptedKey String
  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected output: `✔ Generated Prisma Client`

- [ ] **Step 3: Verify Prisma Client generated**

```bash
ls node_modules/.prisma/client
```

Expected: `index.js` and other files present.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add Prisma schema with User, ChatSession, Message, ApiKey"
```

---

## Task 3: Prisma Client + Encryption

**Files:**
- Create: `src/lib/prisma.ts`
- Create: `src/lib/encryption.ts`
- Create: `tests/lib/encryption.test.ts`

- [ ] **Step 1: Write failing encryption tests**

```typescript
// tests/lib/encryption.test.ts
import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '@/lib/encryption'

describe('encryption', () => {
  it('encrypts and decrypts a string', () => {
    const plaintext = 'sk-ant-api03-test-key-123'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-key'
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext))
  })

  it('round-trips empty string', () => {
    expect(decrypt(encrypt(''))).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/lib/encryption'`

- [ ] **Step 3: Implement encryption.ts**

```typescript
// src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(32 hex) + tag(32 hex) + ciphertext(hex)
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex')
}

export function decrypt(ciphertext: string): string {
  const iv = Buffer.from(ciphertext.slice(0, 32), 'hex')
  const tag = Buffer.from(ciphertext.slice(32, 64), 'hex')
  const encrypted = Buffer.from(ciphertext.slice(64), 'hex')
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — 3 tests in encryption.test.ts

- [ ] **Step 5: Create Prisma client singleton**

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ tests/lib/encryption.test.ts
git commit -m "feat: add Prisma singleton and AES-256-GCM encryption for API keys"
```

---

## Task 4: Document Operations

**Files:**
- Create: `src/lib/doc-ops.ts`
- Create: `tests/lib/doc-ops.test.ts`

The doc-ops module is the core of the live-updating markdown experience. It applies structured edits from the LLM's `update_document` tool call to the markdown string.

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/doc-ops.test.ts
import { describe, it, expect } from 'vitest'
import { applyDocOps } from '@/lib/doc-ops'
import type { DocOp } from '@/lib/doc-ops'

const BASE_DOC = `# Confounding

## Overview

Intro text.

## Core Concepts

Initial concept.`

describe('applyDocOps', () => {
  describe('append', () => {
    it('appends content to an existing section', () => {
      const ops: DocOp[] = [
        { op: 'append', section: '## Core Concepts', content: 'New concept added.' },
      ]
      const result = applyDocOps(BASE_DOC, ops)
      expect(result).toContain('Initial concept.\n\nNew concept added.')
    })

    it('creates section if it does not exist', () => {
      const ops: DocOp[] = [
        { op: 'append', section: '## Misconceptions', content: 'Common mistake.' },
      ]
      const result = applyDocOps(BASE_DOC, ops)
      expect(result).toContain('## Misconceptions\n\nCommon mistake.')
    })
  })

  describe('update', () => {
    it('replaces text within a section', () => {
      const ops: DocOp[] = [
        { op: 'update', section: '## Overview', find: 'Intro text.', replace: 'Better intro.' },
      ]
      const result = applyDocOps(BASE_DOC, ops)
      expect(result).toContain('Better intro.')
      expect(result).not.toContain('Intro text.')
    })
  })

  describe('insert_section', () => {
    it('inserts a new section after a specified heading', () => {
      const ops: DocOp[] = [
        { op: 'insert_section', after: '## Overview', content: '## Procedures\n\nStep 1.' },
      ]
      const result = applyDocOps(BASE_DOC, ops)
      const overviewIdx = result.indexOf('## Overview')
      const proceduresIdx = result.indexOf('## Procedures')
      const conceptsIdx = result.indexOf('## Core Concepts')
      expect(proceduresIdx).toBeGreaterThan(overviewIdx)
      expect(proceduresIdx).toBeLessThan(conceptsIdx)
    })
  })

  describe('replace_section', () => {
    it('replaces entire section content', () => {
      const ops: DocOp[] = [
        { op: 'replace_section', section: '## Core Concepts', content: '## Core Concepts\n\nReplaced content.' },
      ]
      const result = applyDocOps(BASE_DOC, ops)
      expect(result).toContain('Replaced content.')
      expect(result).not.toContain('Initial concept.')
    })
  })

  it('applies multiple ops in sequence', () => {
    const ops: DocOp[] = [
      { op: 'append', section: '## Core Concepts', content: 'Added.' },
      { op: 'append', section: '## Overview', content: 'Also added.' },
    ]
    const result = applyDocOps(BASE_DOC, ops)
    expect(result).toContain('Added.')
    expect(result).toContain('Also added.')
  })

  it('returns unchanged doc when ops array is empty', () => {
    expect(applyDocOps(BASE_DOC, [])).toBe(BASE_DOC)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/lib/doc-ops'`

- [ ] **Step 3: Implement doc-ops.ts**

```typescript
// src/lib/doc-ops.ts
export type DocOp =
  | { op: 'append'; section: string; content: string }
  | { op: 'update'; section: string; find: string; replace: string }
  | { op: 'insert_section'; after: string; content: string }
  | { op: 'replace_section'; section: string; content: string }

export function applyDocOps(markdown: string, ops: DocOp[]): string {
  return ops.reduce((doc, op) => applyDocOp(doc, op), markdown)
}

function getSectionBounds(
  lines: string[],
  heading: string
): { headingIdx: number; contentStart: number; contentEnd: number } | null {
  const headingIdx = lines.findIndex(l => l.trimEnd() === heading)
  if (headingIdx === -1) return null
  const contentStart = headingIdx + 1
  let contentEnd = lines.length
  for (let i = contentStart; i < lines.length; i++) {
    if (lines[i].startsWith('## ') && i > headingIdx) {
      contentEnd = i
      break
    }
  }
  return { headingIdx, contentStart, contentEnd }
}

function applyDocOp(markdown: string, op: DocOp): string {
  const lines = markdown.split('\n')

  if (op.op === 'append') {
    const bounds = getSectionBounds(lines, op.section)
    if (!bounds) {
      // Section doesn't exist — append it at the end
      return markdown.trimEnd() + `\n\n${op.section}\n\n${op.content}`
    }
    // Insert content before the next section (or end)
    const insertAt = bounds.contentEnd
    lines.splice(insertAt, 0, '', op.content)
    return lines.join('\n')
  }

  if (op.op === 'update') {
    const bounds = getSectionBounds(lines, op.section)
    if (!bounds) return markdown
    const sectionLines = lines.slice(bounds.contentStart, bounds.contentEnd)
    const sectionText = sectionLines.join('\n').replace(op.find, op.replace)
    const newLines = [
      ...lines.slice(0, bounds.contentStart),
      ...sectionText.split('\n'),
      ...lines.slice(bounds.contentEnd),
    ]
    return newLines.join('\n')
  }

  if (op.op === 'insert_section') {
    const bounds = getSectionBounds(lines, op.after)
    if (!bounds) {
      return markdown.trimEnd() + `\n\n${op.content}`
    }
    lines.splice(bounds.contentEnd, 0, '', ...op.content.split('\n'))
    return lines.join('\n')
  }

  if (op.op === 'replace_section') {
    const bounds = getSectionBounds(lines, op.section)
    if (!bounds) return markdown
    const newLines = [
      ...lines.slice(0, bounds.headingIdx),
      ...op.content.split('\n'),
      ...lines.slice(bounds.contentEnd),
    ]
    return newLines.join('\n')
  }

  return markdown
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all doc-ops tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/doc-ops.ts tests/lib/doc-ops.test.ts
git commit -m "feat: add document operation engine for LLM-driven markdown edits"
```

---

## Task 5: Extraction Prompt

**Files:**
- Create: `src/lib/extraction-prompt.ts`
- Create: `tests/lib/extraction-prompt.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/extraction-prompt.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildSystemPrompt,
  UPDATE_DOCUMENT_TOOL,
  buildMessages,
} from '@/lib/extraction-prompt'

describe('buildSystemPrompt', () => {
  it('includes the current document state', () => {
    const prompt = buildSystemPrompt('## Core Concepts\n\nFoo.')
    expect(prompt).toContain('## Core Concepts')
    expect(prompt).toContain('Foo.')
  })

  it('includes extraction phase instructions', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('Scope & Context')
    expect(prompt).toContain('Core Concepts')
    expect(prompt).toContain('Misconceptions')
  })

  it('uses empty document placeholder when document is empty', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('(empty)')
  })
})

describe('UPDATE_DOCUMENT_TOOL', () => {
  it('has required fields for Anthropic tool format', () => {
    expect(UPDATE_DOCUMENT_TOOL.name).toBe('update_document')
    expect(UPDATE_DOCUMENT_TOOL.input_schema).toBeDefined()
    expect(UPDATE_DOCUMENT_TOOL.input_schema.properties.ops).toBeDefined()
  })
})

describe('buildMessages', () => {
  it('converts stored messages to Anthropic format', () => {
    const stored = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]
    const messages = buildMessages(stored)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' })
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there' })
  })

  it('adds a new user message when provided', () => {
    const messages = buildMessages([], 'New question')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual({ role: 'user', content: 'New question' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/lib/extraction-prompt'`

- [ ] **Step 3: Implement extraction-prompt.ts**

```typescript
// src/lib/extraction-prompt.ts

export const SYSTEM_PROMPT_TEMPLATE = `You are Socratize, a knowledge extraction specialist. Your role is to interview domain experts and capture their knowledge into a structured markdown document suitable for training AI agents.

You conduct a Socratic dialogue to surface tacit knowledge — the expertise that experts possess but struggle to articulate unprompted. Ask probing questions to draw out:
- Core concepts and definitions
- Procedures and decision-making frameworks
- Common misconceptions and edge cases
- The "I just know to check for X" moments that represent deep expertise

## Interview Guidelines

- Ask **one probing question at a time**
- When an answer is vague, probe for specifics: "Can you give me a concrete example?" or "What would a student actually do wrong here?"
- Surface tacit knowledge: "You said you 'just know' to check X — what's the underlying reasoning?"
- Detect the knowledge type (conceptual, procedural, decision framework) and adapt your probing
- Keep responses concise — you are interviewing, not lecturing
- Transition naturally when a topic feels covered: "I think I've captured the core of this topic. Want me to probe deeper on any aspect, or does this feel complete?"
- On the first message, greet briefly and ask: "Tell me about [topic] — who are you teaching this to, and what do they need to walk away understanding?"

## Document Structure

Build the document with these sections (use judgment — not every section applies):
1. Top-level heading: the topic name
2. \`## Overview\` — domain, audience, level, learning objectives
3. \`## Core Concepts\` — key ideas, definitions, relationships
4. \`## Procedures\` — step-by-step workflows, decision frameworks
5. \`## Common Misconceptions\` — what students get wrong
6. \`## Edge Cases\` — subtle distinctions, non-obvious scenarios

Always call \`update_document\` after each exchange — even a single sentence of new knowledge is worth capturing immediately.

## Current Document State

\`\`\`markdown
{document}
\`\`\`
`

export function buildSystemPrompt(currentDocument: string): string {
  const doc = currentDocument.trim() || '(empty)'
  return SYSTEM_PROMPT_TEMPLATE.replace('{document}', doc)
}

export const UPDATE_DOCUMENT_TOOL = {
  name: 'update_document',
  description:
    'Apply edits to the knowledge document. Call this after every exchange to capture newly extracted knowledge.',
  input_schema: {
    type: 'object' as const,
    properties: {
      ops: {
        type: 'array',
        description: 'List of document operations to apply in order',
        items: {
          type: 'object',
          properties: {
            op: {
              type: 'string',
              enum: ['append', 'update', 'insert_section', 'replace_section'],
            },
            section: { type: 'string', description: 'Section heading, e.g. "## Core Concepts"' },
            content: { type: 'string', description: 'Content to append or insert' },
            after: { type: 'string', description: 'Heading to insert the new section after' },
            find: { type: 'string', description: 'Text to find within the section (for update op)' },
            replace: { type: 'string', description: 'Replacement text (for update op)' },
          },
          required: ['op'],
        },
      },
    },
    required: ['ops'],
  },
}

// OpenAI format tool definition (same structure, different key name)
export const UPDATE_DOCUMENT_TOOL_OPENAI = {
  type: 'function' as const,
  function: {
    name: 'update_document',
    description: UPDATE_DOCUMENT_TOOL.description,
    parameters: UPDATE_DOCUMENT_TOOL.input_schema,
  },
}

export interface StoredMessage {
  role: string
  content: string
}

export function buildMessages(
  history: StoredMessage[],
  newMessage?: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  if (newMessage) {
    messages.push({ role: 'user', content: newMessage })
  }

  return messages
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all 7 extraction-prompt tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extraction-prompt.ts tests/lib/extraction-prompt.test.ts
git commit -m "feat: add extraction system prompt and update_document tool definition"
```

---

## Task 6: Auth Setup

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/login/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create auth config**

```typescript
// src/lib/auth.ts
import { type NextAuthOptions, getServerSession } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user as { id: string; name?: string | null; email?: string | null }
}
```

- [ ] **Step 2: Extend NextAuth types**

Create `src/types/next-auth.d.ts`:

```typescript
// src/types/next-auth.d.ts
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
```

- [ ] **Step 3: Create NextAuth route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 4: Create login page**

```tsx
// src/app/login/page.tsx
'use client'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 p-10 rounded-xl shadow-xl max-w-sm w-full text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Socratize</h1>
        <p className="text-gray-400 mb-8 text-sm">
          Extract your expertise into AI-ready knowledge files
        </p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full bg-white text-gray-900 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-100 transition"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update root layout with SessionProvider**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Socratize',
  description: 'Extract domain expertise into AI-ready knowledge files',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-gray-100`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Create Providers component**

```tsx
// src/app/providers.tsx
'use client'
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

- [ ] **Step 7: Create root redirect**

```tsx
// src/app/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function RootPage() {
  const session = await getServerSession(authOptions)
  redirect(session ? '/dashboard' : '/login')
}
```

- [ ] **Step 8: Run dev server to verify auth routes exist**

```bash
npm run dev
```

Open http://localhost:3000 — should redirect to `/login`. No 500 errors.

- [ ] **Step 9: Commit**

```bash
git add src/
git commit -m "feat: add NextAuth with Google OAuth, login page, session provider"
```

---

## Task 7: Session API Routes

**Files:**
- Create: `src/app/api/sessions/route.ts`
- Create: `src/app/api/sessions/[id]/route.ts`
- Create: `src/app/api/sessions/[id]/document/route.ts`
- Create: `src/app/api/sessions/[id]/export/route.ts`

- [ ] **Step 1: Create sessions list + create route**

```typescript
// src/app/api/sessions/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireAuth()
    const sessions = await prisma.chatSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        llmProvider: true,
        model: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    })
    return NextResponse.json(sessions)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { title, llmProvider = 'anthropic', model = 'claude-sonnet-4-5-20250514' } =
      await request.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const session = await prisma.chatSession.create({
      data: { userId: user.id, title: title.trim(), llmProvider, model },
    })
    return NextResponse.json(session, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

- [ ] **Step 2: Create single session route (GET + DELETE)**

```typescript
// src/app/api/sessions/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const session = await prisma.chatSession.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    })
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(session)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const session = await prisma.chatSession.findFirst({
      where: { id: params.id, userId: user.id },
    })
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.chatSession.delete({ where: { id: params.id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

- [ ] **Step 3: Create document direct-edit route**

```typescript
// src/app/api/sessions/[id]/document/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const { markdownContent } = await request.json()

    const session = await prisma.chatSession.findFirst({
      where: { id: params.id, userId: user.id },
    })
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.chatSession.update({
      where: { id: params.id },
      data: { markdownContent },
    })
    return NextResponse.json({ markdownContent: updated.markdownContent })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

- [ ] **Step 4: Create export route**

```typescript
// src/app/api/sessions/[id]/export/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const session = await prisma.chatSession.findFirst({
      where: { id: params.id, userId: user.id },
      select: { title: true, markdownContent: true },
    })
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const filename = session.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    return new NextResponse(session.markdownContent, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${filename}.md"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/sessions/
git commit -m "feat: add session CRUD API routes with auth and export"
```

---

## Task 8: API Keys Route

**Files:**
- Create: `src/app/api/keys/route.ts`
- Create: `src/app/api/keys/[id]/route.ts`

- [ ] **Step 1: Create keys route**

```typescript
// src/app/api/keys/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'

export async function GET() {
  try {
    const user = await requireAuth()
    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      select: { id: true, provider: true },
    })
    return NextResponse.json(keys)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { provider, key } = await request.json()

    if (!['anthropic', 'openai'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }
    if (!key?.trim()) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    const apiKey = await prisma.apiKey.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      create: { userId: user.id, provider, encryptedKey: encrypt(key.trim()) },
      update: { encryptedKey: encrypt(key.trim()) },
      select: { id: true, provider: true },
    })
    return NextResponse.json(apiKey, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

- [ ] **Step 2: Create key delete route**

```typescript
// src/app/api/keys/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const key = await prisma.apiKey.findFirst({
      where: { id: params.id, userId: user.id },
    })
    if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.apiKey.delete({ where: { id: params.id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/keys/
git commit -m "feat: add API key save/delete routes with encryption"
```

---

## Task 9: Chat API Route (Streaming)

**Files:**
- Create: `src/app/api/chat/route.ts`

This is the core route. It proxies messages to the LLM, streams text back via SSE, and applies `update_document` tool calls to the stored markdown.

- [ ] **Step 1: Create chat route**

```typescript
// src/app/api/chat/route.ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { decrypt } from '@/lib/encryption'
import { applyDocOps, type DocOp } from '@/lib/doc-ops'
import {
  buildSystemPrompt,
  UPDATE_DOCUMENT_TOOL,
  UPDATE_DOCUMENT_TOOL_OPENAI,
  buildMessages,
} from '@/lib/extraction-prompt'

export async function POST(request: Request) {
  let user: { id: string }
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sessionId, message } = await request.json()
  if (!sessionId || !message?.trim()) {
    return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 })
  }

  // Load session, history, and user's API key
  const [session, messages, apiKeyRecord] = await Promise.all([
    prisma.chatSession.findFirst({ where: { id: sessionId, userId: user.id } }),
    prisma.message.findMany({
      where: { chatSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.apiKey.findFirst({
      where: { userId: user.id, provider: { in: ['anthropic', 'openai'] } },
    }),
  ])

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (!apiKeyRecord) {
    return NextResponse.json(
      { error: 'No API key found. Add one in Settings.' },
      { status: 400 }
    )
  }

  const decryptedKey = decrypt(apiKeyRecord.encryptedKey)
  const systemPrompt = buildSystemPrompt(session.markdownContent)
  const conversationMessages = buildMessages(messages, message.trim())

  const encoder = new TextEncoder()
  let fullAssistantText = ''
  let extractedOps: DocOp[] = []

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        if (apiKeyRecord.provider === 'anthropic') {
          const anthropic = new Anthropic({ apiKey: decryptedKey })
          const anthropicStream = anthropic.messages.stream({
            model: session.model,
            max_tokens: 2048,
            system: systemPrompt,
            tools: [UPDATE_DOCUMENT_TOOL as any],
            messages: conversationMessages,
          })

          let toolInputBuffer = ''
          let inToolUse = false

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
              inToolUse = true
              toolInputBuffer = ''
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                fullAssistantText += event.delta.text
                send({ type: 'text', delta: event.delta.text })
              } else if (event.delta.type === 'input_json_delta') {
                toolInputBuffer += event.delta.partial_json
              }
            } else if (event.type === 'content_block_stop' && inToolUse) {
              try {
                const parsed = JSON.parse(toolInputBuffer)
                extractedOps = parsed.ops ?? []
                send({ type: 'doc_ops', ops: extractedOps })
              } catch {}
              inToolUse = false
              toolInputBuffer = ''
            }
          }
        } else {
          // OpenAI
          const openai = new OpenAI({ apiKey: decryptedKey })
          const openaiStream = await openai.chat.completions.create({
            model: session.model,
            stream: true,
            tools: [UPDATE_DOCUMENT_TOOL_OPENAI],
            messages: [
              { role: 'system', content: systemPrompt },
              ...conversationMessages,
            ],
          })

          let toolCallBuffer = ''
          for await (const chunk of openaiStream) {
            const delta = chunk.choices[0]?.delta
            if (delta?.content) {
              fullAssistantText += delta.content
              send({ type: 'text', delta: delta.content })
            }
            if (delta?.tool_calls?.[0]?.function?.arguments) {
              toolCallBuffer += delta.tool_calls[0].function.arguments
            }
            if (chunk.choices[0]?.finish_reason === 'tool_calls' && toolCallBuffer) {
              try {
                const parsed = JSON.parse(toolCallBuffer)
                extractedOps = parsed.ops ?? []
                send({ type: 'doc_ops', ops: extractedOps })
              } catch {}
            }
          }
        }

        // Apply doc ops and save to DB
        const newMarkdown = applyDocOps(session.markdownContent, extractedOps)
        await Promise.all([
          prisma.message.create({
            data: { chatSessionId: sessionId, role: 'user', content: message.trim() },
          }),
          prisma.message.create({
            data: {
              chatSessionId: sessionId,
              role: 'assistant',
              content: fullAssistantText,
              docOps: extractedOps.length ? JSON.stringify(extractedOps) : null,
            },
          }),
          prisma.chatSession.update({
            where: { id: sessionId },
            data: { markdownContent: newMarkdown },
          }),
        ])

        send({ type: 'done' })
      } catch (err) {
        send({ type: 'error', message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/chat/
git commit -m "feat: add streaming chat API route with Anthropic/OpenAI tool use"
```

---

## Task 10: useChat Hook

**Files:**
- Create: `src/hooks/useChat.ts`

- [ ] **Step 1: Create useChat hook**

```typescript
// src/hooks/useChat.ts
import { useState, useCallback } from 'react'
import { type DocOp } from '@/lib/doc-ops'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface UseChatOptions {
  sessionId: string
  initialMessages?: ChatMessage[]
  onDocOps: (ops: DocOp[]) => void
}

export function useChat({ sessionId, initialMessages = [], onDocOps }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return
      setError(null)
      setIsStreaming(true)

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }
      setMessages(prev => [...prev, userMsg])

      let assistantText = ''
      setStreamingText('')

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: content }),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error ?? 'Failed to send message')
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          const text = decoder.decode(value)
          const lines = text.split('\n\n').filter(l => l.startsWith('data: '))

          for (const line of lines) {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'text') {
              assistantText += event.delta
              setStreamingText(assistantText)
            } else if (event.type === 'doc_ops') {
              onDocOps(event.ops)
            } else if (event.type === 'error') {
              throw new Error(event.message)
            } else if (event.type === 'done') {
              setMessages(prev => [
                ...prev,
                { id: crypto.randomUUID(), role: 'assistant', content: assistantText },
              ])
              setStreamingText('')
            }
          }
        }
      } catch (err) {
        setError(String(err))
        setMessages(prev => prev.slice(0, -1)) // Remove optimistic user message
      } finally {
        setIsStreaming(false)
      }
    },
    [sessionId, isStreaming, onDocOps]
  )

  return { messages, streamingText, isStreaming, error, sendMessage }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/
git commit -m "feat: add useChat hook for SSE streaming with doc_ops callback"
```

---

## Task 11: UI Components

**Files:**
- Create: `src/components/ChatPane.tsx`
- Create: `src/components/EditorPane.tsx`
- Create: `src/components/SessionView.tsx`
- Create: `src/components/SessionCard.tsx`
- Create: `src/components/NewSessionDialog.tsx`

- [ ] **Step 1: Create ChatPane**

```tsx
// src/components/ChatPane.tsx
'use client'
import { useRef, useEffect, useState } from 'react'
import type { ChatMessage } from '@/hooks/useChat'

interface ChatPaneProps {
  messages: ChatMessage[]
  streamingText: string
  isStreaming: boolean
  error: string | null
  onSend: (message: string) => void
}

export function ChatPane({ messages, streamingText, isStreaming, error, onSend }: ChatPaneProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500">
        Conversation
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                msg.role === 'assistant' ? 'bg-red-600' : 'bg-blue-700'
              }`}
            >
              {msg.role === 'assistant' ? 'S' : 'P'}
            </div>
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? 'bg-gray-800 rounded-tl-sm'
                  : 'bg-gray-700 rounded-tr-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold shrink-0">
              S
            </div>
            <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-sm bg-gray-800 text-sm leading-relaxed">
              {streamingText}
              <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-middle" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder={isStreaming ? 'Waiting for response...' : 'Share your expertise...'}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create EditorPane**

```tsx
// src/components/EditorPane.tsx
'use client'
import dynamic from 'next/dynamic'
import { useCallback } from 'react'
import { markdown } from '@codemirror/lang-markdown'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

interface EditorPaneProps {
  filename: string
  content: string
  onChange: (value: string) => void
  onDownload: () => void
}

export function EditorPane({ filename, content, onChange, onDownload }: EditorPaneProps) {
  const handleDownload = useCallback(() => onDownload(), [onDownload])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500 flex justify-between items-center">
        <span className="font-mono">{filename}</span>
        <div className="flex items-center gap-3">
          <span className="text-green-500">● Auto-updating</span>
          <button
            onClick={handleDownload}
            className="text-blue-400 hover:text-blue-300 transition text-xs"
          >
            Download .md
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          onChange={onChange}
          height="100%"
          theme="dark"
          extensions={[]}
          extensions={[markdown()]}
          className="h-full text-sm"
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create SessionView**

```tsx
// src/components/SessionView.tsx
'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChatPane } from './ChatPane'
import { EditorPane } from './EditorPane'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { applyDocOps, type DocOp } from '@/lib/doc-ops'

interface SessionViewProps {
  sessionId: string
  title: string
  initialMessages: ChatMessage[]
  initialMarkdown: string
}

export function SessionView({
  sessionId,
  title,
  initialMessages,
  initialMarkdown,
}: SessionViewProps) {
  const router = useRouter()
  const [markdown, setMarkdown] = useState(initialMarkdown)

  const handleDocOps = useCallback((ops: DocOp[]) => {
    setMarkdown(prev => applyDocOps(prev, ops))
  }, [])

  const { messages, streamingText, isStreaming, error, sendMessage } = useChat({
    sessionId,
    initialMessages,
    onDocOps: handleDocOps,
  })

  const handleMarkdownChange = useCallback(
    async (value: string) => {
      setMarkdown(value)
      await fetch(`/api/sessions/${sessionId}/document`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: value }),
      })
    },
    [sessionId]
  )

  const handleDownload = useCallback(() => {
    window.location.href = `/api/sessions/${sessionId}/export`
  }, [sessionId])

  const filename =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '.md'

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-300 text-sm transition"
          >
            ← Dashboard
          </button>
          <span className="text-sm text-gray-400">{title}</span>
        </div>
        <span className="text-lg font-bold text-red-500">Socratize</span>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 border-r border-gray-800 min-h-0">
          <ChatPane
            messages={messages}
            streamingText={streamingText}
            isStreaming={isStreaming}
            error={error}
            onSend={sendMessage}
          />
        </div>
        <div className="flex-1 min-h-0">
          <EditorPane
            filename={filename}
            content={markdown}
            onChange={handleMarkdownChange}
            onDownload={handleDownload}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create SessionCard**

```tsx
// src/components/SessionCard.tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface SessionCardProps {
  id: string
  title: string
  updatedAt: string
  messageCount: number
  llmProvider: string
  onDelete: (id: string) => void
}

export function SessionCard({
  id,
  title,
  updatedAt,
  messageCount,
  llmProvider,
  onDelete,
}: SessionCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${title}"?`)) return
    setDeleting(true)
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    onDelete(id)
  }

  return (
    <div
      onClick={() => router.push(`/sessions/${id}`)}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-700 transition group"
    >
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-gray-100 group-hover:text-white transition">{title}</h3>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-gray-600 hover:text-red-400 transition text-xs opacity-0 group-hover:opacity-100"
        >
          Delete
        </button>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
        <span>{messageCount} messages</span>
        <span>·</span>
        <span className="capitalize">{llmProvider}</span>
        <span>·</span>
        <span>{new Date(updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create NewSessionDialog**

```tsx
// src/components/NewSessionDialog.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface NewSessionDialogProps {
  onClose: () => void
}

export function NewSessionDialog({ onClose }: NewSessionDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [provider, setProvider] = useState('anthropic')
  const [model, setModel] = useState('claude-sonnet-4-5-20250514')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleProviderChange = (p: string) => {
    setProvider(p)
    setModel(p === 'anthropic' ? 'claude-sonnet-4-5-20250514' : 'gpt-4o')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), llmProvider: provider, model }),
    })

    if (!res.ok) {
      setError('Failed to create session')
      setLoading(false)
      return
    }

    const session = await res.json()
    router.push(`/sessions/${session.id}`)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-6">New Session</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-2">What knowledge do you want to capture?</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Confounding in Epidemiology"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">LLM Provider</label>
            <select
              value={provider}
              onChange={e => handleProviderChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Model</label>
            <input
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-sm py-2.5 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm py-2.5 rounded-lg font-medium transition"
            >
              {loading ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/hooks/
git commit -m "feat: add ChatPane, EditorPane, SessionView, SessionCard, NewSessionDialog components"
```

---

## Task 12: Pages

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/sessions/[id]/page.tsx`
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Create dashboard page**

```tsx
// src/app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from './client'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const sessions = await prisma.chatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, llmProvider: true, model: true,
      createdAt: true, updatedAt: true,
      _count: { select: { messages: true } },
    },
  })

  return <DashboardClient initialSessions={sessions} userName={session.user.name ?? 'there'} />
}
```

- [ ] **Step 2: Create dashboard client component**

```tsx
// src/app/dashboard/client.tsx
'use client'
import { useState } from 'react'
import { SessionCard } from '@/components/SessionCard'
import { NewSessionDialog } from '@/components/NewSessionDialog'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

interface SessionSummary {
  id: string
  title: string
  llmProvider: string
  updatedAt: string
  _count: { messages: number }
}

interface DashboardClientProps {
  initialSessions: SessionSummary[]
  userName: string
}

export function DashboardClient({ initialSessions, userName }: DashboardClientProps) {
  const [sessions, setSessions] = useState(initialSessions)
  const [showDialog, setShowDialog] = useState(false)

  const handleDelete = (id: string) => setSessions(prev => prev.filter(s => s.id !== id))

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <span className="text-xl font-bold text-red-500">Socratize</span>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <Link href="/settings" className="hover:text-gray-200 transition">Settings</Link>
          <button onClick={() => signOut()} className="hover:text-gray-200 transition">Sign out</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Hi, {userName}</h1>
            <p className="text-gray-500 text-sm mt-1">Your knowledge extraction sessions</p>
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
          >
            + New Session
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg mb-2">No sessions yet</p>
            <p className="text-sm">Start one to begin extracting your expertise</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <SessionCard
                key={s.id}
                id={s.id}
                title={s.title}
                updatedAt={s.updatedAt}
                messageCount={s._count.messages}
                llmProvider={s.llmProvider}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {showDialog && <NewSessionDialog onClose={() => setShowDialog(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: Create session page**

```tsx
// src/app/sessions/[id]/page.tsx
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SessionView } from '@/components/SessionView'

export default async function SessionPage({ params }: { params: { id: string } }) {
  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.id) redirect('/login')

  const chatSession = await prisma.chatSession.findFirst({
    where: { id: params.id, userId: authSession.user.id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true },
      },
    },
  })
  if (!chatSession) notFound()

  const initialMessages = chatSession.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))

  return (
    <SessionView
      sessionId={chatSession.id}
      title={chatSession.title}
      initialMessages={initialMessages}
      initialMarkdown={chatSession.markdownContent}
    />
  )
}
```

- [ ] **Step 4: Create settings page**

```tsx
// src/app/settings/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ApiKey { id: string; provider: string }

export default function SettingsPage() {
  const router = useRouter()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [provider, setProvider] = useState('anthropic')
  const [keyValue, setKeyValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/keys').then(r => r.json()).then(setKeys)
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key: keyValue }),
    })
    if (res.ok) {
      const newKey = await res.json()
      setKeys(prev => [...prev.filter(k => k.provider !== provider), newKey])
      setKeyValue('')
      setMessage('Saved!')
    } else {
      setMessage('Failed to save key')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-300 text-sm transition">
          ← Dashboard
        </button>
        <span className="text-lg font-semibold">Settings</span>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10">
        <h2 className="text-lg font-semibold mb-2">API Keys</h2>
        <p className="text-gray-500 text-sm mb-6">
          Keys are encrypted at rest. Required to start extraction sessions.
        </p>

        {keys.length > 0 && (
          <div className="mb-6 space-y-2">
            {keys.map(k => (
              <div key={k.id} className="flex justify-between items-center bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm">
                <span className="capitalize">{k.provider} key saved</span>
                <button onClick={() => handleDelete(k.id)} className="text-gray-600 hover:text-red-400 transition text-xs">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Provider</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">API Key</label>
            <input
              type="password"
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
              placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-gray-500"
            />
          </div>
          {message && <p className={`text-sm ${message === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}
          <button
            type="submit"
            disabled={saving || !keyValue.trim()}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm font-medium py-2.5 rounded-lg transition"
          >
            {saving ? 'Saving...' : 'Save Key'}
          </button>
        </form>
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/
git commit -m "feat: add dashboard, session, and settings pages"
```

---

## Task 13: Final Wiring & Verification

**Files:**
- Modify: `src/app/globals.css` (ensure dark background)
- Modify: `next.config.ts` (if needed for CodeMirror)

- [ ] **Step 1: Update globals.css for dark theme**

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

html, body {
  background-color: #030712;
  color: #f9fafb;
}
```

- [ ] **Step 2: Update tailwind.config to ensure dark mode**

In `tailwind.config.ts`, ensure:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: {} },
  plugins: [],
}
export default config
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All unit tests pass (encryption, doc-ops, extraction-prompt).

- [ ] **Step 4: Run dev server**

```bash
npm run dev
```

- [ ] **Step 5: Verify session creation end-to-end**

1. Open http://localhost:3000 → redirects to `/login`
2. Click "Sign in with Google" (requires real Google OAuth credentials in `.env.local`) OR test the dashboard directly by temporarily removing auth on the dashboard page
3. From dashboard, click "+ New Session"
4. Enter a topic, select provider, click "Start Session"
5. Verify the split-pane view loads with an empty markdown document on the right

- [ ] **Step 6: Verify knowledge extraction**

1. In the session view, type a message in the chat input
2. Send it — the LLM should respond in the left pane and the markdown document should update on the right
3. Verify the doc ops are being applied (new content appears in the markdown)

- [ ] **Step 7: Verify export**

1. Click "Download .md" in the editor pane header
2. Verify a markdown file downloads with the session's content

- [ ] **Step 8: Verify session resume**

1. Navigate back to the dashboard
2. Click the session again
3. Verify the conversation history and markdown state are restored

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat: complete Socratize v1 — knowledge extraction webapp"
```

- [ ] **Step 10: Type-check**

```bash
npx tsc --noEmit
```

Expected: No type errors. Fix any that appear before considering the implementation complete.
