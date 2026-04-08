# Socratize

Tacit knowledge is what makes an expert successful, but it is difficult to articulate such intuition, judgment calls, and the reasoning/thinking that underpins expertise. Socratize extracts them by interviewing you using the principle of Socratic dialogue.

Socratize is available as an npm package. You can install it via:

```bash
npx socratize
```

No signup. Everything runs on your machine and makes use of your API key.

---

## How It Works

Since Socratize is a local web app, your sessions, sandboxes, and API keys stay on disk at `~/.socratize/`. If you're using it for the first time, go to Settings and configure your API key.

### Socratic Dialogue

Create a session, give it a topic, and point it at a folder on your computer. The right pane is a chat with the interviewer. The left pane is the document being built.

The interviewer doesn't ask you to summarize everything you know. It opens with a question designed to surface tacit knowledge — something specific that makes you think about how you actually work, not how you'd describe it to a student. You answer; it probes; the document updates in real time. If you already have a structure in mind, the interviewer also adapts.

### Skill Crafting 

When the conversation feels complete, Skill Crafting takes the extracted notes and turns them into a properly structured skill file: when to use it, the process, the rules, the common mistakes. If something's missing or unclear, it asks follow-up questions before writing the final document.

The result is markdown files in your chosen folder that you can load into Sandbox mode to test your skills directly!

### Sandbox

Open a sandbox, select the folder you built, and start a conversation with an agent equipped with your skills. Upload files (PDFs, code, datasets) and the Agent can read them, write new files, and run code in a built-in terminal.
During the conversation, it selects the relevant skills and use them accordingly.

**Skills improve through use:** After each Agent responses, you can choose to click thumbs up or down. A comment field appears; the feedback saves to `feedback.md` in your skills folder. You can subsequently start a new interview pointing at the folder, and tell Socratize to work through each comment with you.

---

## Your Data

```
~/.socratize/
  data.db      — sessions, sandboxes, encrypted API keys
  config.json  — encryption key (generated on first run)
```

---

## Stack

- Next.js 16 (App Router) + TypeScript
- Prisma + SQLite
- CodeMirror (markdown editor)
- xterm.js + node-pty (terminal)
- Anthropic SDK + OpenAI SDK

---

## License

MIT License. Socratize is built by Chaipat Tirapongprasert as part of the aiX Convergence Design Studio Internship.
