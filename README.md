# Socratize

A webapp that interviews domain experts using Socratic dialogue to extract their tacit knowledge into structured markdown files — ready to be fed into AI agents.

## How It Works

1. Add your Anthropic or OpenAI API key in Settings
2. Create a new session and enter a topic ("Confounding in Epidemiology")
3. Chat with the AI — it asks probing questions to draw out your knowledge
4. Watch the markdown document form in real-time on the right pane
5. Edit the document directly if you want to tweak anything
6. Download the finished `.md` file

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/chaipattira/socratize
cd socratize
npm install
```

### 2. Set up environment variables

Copy the example and fill in the values:

```bash
cp .env.local.example .env.local
```

`.env.local` needs:

```
# Encryption key for stored API keys (64 hex chars = 32 bytes)
# generate with: openssl rand -hex 32
ENCRYPTION_KEY=

# Database
DATABASE_URL=file:./prisma/dev.db
```

### 3. Set up the database

```bash
npx prisma migrate dev --name init
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding an API Key

Go to **Settings** and add your Anthropic (`sk-ant-...`) or OpenAI (`sk-...`) key. Keys are encrypted with AES-256-GCM before being stored.

## Data Storage

- Session metadata and chat history: `prisma/dev.db` (SQLite)
- Markdown documents: `data/docs/<session-id>.md` (one file per session)

## Stack

- Next.js 16 (App Router) + TypeScript
- Prisma v7 + SQLite
- CodeMirror (markdown editor)
- Anthropic SDK + OpenAI SDK
- Vitest

## Tests

```bash
npm test
```
