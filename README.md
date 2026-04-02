# Socratize

A webapp that interviews domain experts using Socratic dialogue to extract their tacit knowledge into structured markdown files — ready to be fed into AI agents.

## How It Works

1. Sign in with Google
2. Add your Anthropic or OpenAI API key in Settings
3. Create a new session and enter a topic ("Confounding in Epidemiology")
4. Chat with the AI — it asks probing questions to draw out your knowledge
5. Watch the markdown document form in real-time on the right pane
6. Edit the document directly if you want to tweak anything
7. Download the finished `.md` file

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
# Google OAuth — create at https://console.cloud.google.com/
# Authorized redirect URIs: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# NextAuth
NEXTAUTH_SECRET=      # generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

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

After signing in, go to **Settings** and add your Anthropic (`sk-ant-...`) or OpenAI (`sk-...`) key. Keys are encrypted with AES-256-GCM before being stored.

## Stack

- Next.js 14 (App Router) + TypeScript
- Prisma v7 + SQLite
- NextAuth.js (Google OAuth)
- CodeMirror (markdown editor)
- Anthropic SDK + OpenAI SDK
- Vitest

## Tests

```bash
npm test
```
