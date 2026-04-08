# Socratize

Tacit knowledge is what makes an expert successful, but it is difficult to articulate such intuition, judgment calls, and the reasoning/thinking that underpins expertise. Socratize extracts them by interviewing you using the principle of Socratic dialogue.

## Getting Started

**Requirement:** Node.js 18 or later

Run this in your terminal — no global install needed:

```bash
npx socratize
```

Or install directly from GitHub:

```bash
npx github:chaipattira/socratize
```

On first run, Socratize sets up `~/.socratize/` on your machine and opens the app in your browser automatically.

**Add your API key:** Go to **Settings** and enter your Anthropic or OpenAI API key. Your sessions, sandboxes, and API keys stay local — no account, no cloud sync.

---

## How It Works

The typical workflow goes as follows: **Socratic Dialogue → Skill Crafting → Sandbox**. Each step feeds into the next, but you can start anywhere.

### 1. Socratic Dialogue

Create a new interview, give it a topic (e.g. "How I do code review"), and point it at a folder on your computer.

- The **right pane** is a chat with an AI interviewer.
- The **left pane** is the document it's building as you talk.

The interviewer doesn't ask you to summarize everything you know. It opens with a targeted question designed to surface tacit knowledge — something specific that makes you think about how you actually work, not how you'd explain it to a student. You answer; it probes deeper; the document updates in real time. If you already have a structure in mind, the interviewer adapts to it.

### 2. Skill Crafting

Once you have notes in a folder, start a **Skill Crafting** session pointing at the same folder.

The agent reads your notes and turns them into structured skill files — each covering when to apply the skill, the step-by-step process, the key rules, and common mistakes. If something is missing or ambiguous, it asks follow-up questions before writing. The result is a set of `.md` files in your folder, ready to load into Sandbox.

### 3. Sandbox

Create a sandbox, point it at your skills folder, and optionally give the agent a workspace folder to read and write files in.

The agent reads your skill files automatically and applies them during the conversation. It can also read uploaded files (PDFs, code, datasets), write new files to the workspace, and run code in a built-in terminal.

**Improving skills through use:** After each agent response, you can rate it with a thumbs up or down and leave a comment. Feedback is saved to `feedback.md` in your skills folder. Start a new Skill Crafting session pointing at the same folder, and the agent will work through each comment with you — updating the skills based on what you observed.

---

## Your Data

```
~/.socratize/
  data.db      — sessions, sandboxes, encrypted API keys
  config.json  — encryption key (generated on first run)
```

---

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Prisma + SQLite
- CodeMirror (markdown editor)
- xterm.js + node-pty (terminal)
- Anthropic SDK + OpenAI SDK

---

## License

MIT License.

Socratize is built by Chaipat Tirapongprasert as part of the aiX Convergence Design Studio Internship.
