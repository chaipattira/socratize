# socratize

A Claude Code plugin that helps scientists and educators build a high-quality knowledge base
for their codebase, then review it with a persona panel.

## Skills

- **build-knowledge-base** — scans your repo, classifies docs by Diátaxis, reports gaps and
  type-conflation, and authors a new page through Socratic Q&A with a self-review + approval loop.
- **review-with-socratize-agents** — fans out reviewer personas (reproducibility, domain
  accuracy, instructional clarity, newcomer, sustainability) in parallel; each writes a
  structured report; obvious fixes are applied and judgment calls are brought back to you.

## Install

```bash
/plugin marketplace add <this-repo-url>
/plugin install socratize
```

## Custom personas

Drop `*.md` files in your repo's `.claude/personas/` to add domain reviewers (e.g. a
physicist, a statistician, an assessment designer). The panel merges them with the bundled set.
See `skills/review-with-socratize-agents/persona-format.md` for the required fields.
