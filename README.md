# socratize

A Claude Code plugin that helps scientists and educators build a high-quality knowledge base
for their codebase, then review it with a persona panel.

## Skills

- **build-knowledge-base** — scans your repo, classifies docs by Diátaxis, reports gaps and
  type-conflation, and authors a new page through Socratic Q&A with a self-review + approval loop.
- **socratize-me** — fans out reviewer personas (reproducibility, domain
  accuracy, instructional clarity, newcomer, sustainability) in parallel; each writes a
  structured report; obvious fixes are applied and judgment calls are brought back to you.
- **distill-skill** — turns your existing docs into a distributable Claude Code skill. It
  suggests what to convert, maps each Diátaxis type into a skill (how-to → steps, reference →
  bundled lookup, explanation → background), and verifies the result with a subagent that
  actually uses the skill before you ship it. Runs standalone; writes to `.claude/skills/<name>/`.

## Install

```bash
/plugin marketplace add <this-repo-url>
/plugin install socratize
```

## Custom personas

Drop `*.md` files in your repo's `.claude/personas/` to add domain reviewers (e.g. a
physicist, a statistician, an assessment designer). The panel merges them with the bundled set.
See `skills/socratize-me/persona-format.md` for the required fields.
