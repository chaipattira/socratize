# Skill anatomy — what makes a good SKILL.md

Reference for Step 6 (draft) and Step 9 (self-review). Trimmed from Anthropic's skill-authoring
guidance, retargeted to skills distilled from research docs.

## SKILL.md structure

A skill is a directory: `SKILL.md` (required) plus optional `references/` and `scripts/`. The
`SKILL.md` carries YAML frontmatter (`name`, `description`) and a Markdown body:

```markdown
---
name: run-the-simulation
description: Use when ...
---

# Run the simulation

## Overview
One or two sentences: what this does and the core idea.

## When to use
Symptoms and situations. When NOT to use.

## Steps
1. ...

## Reference
Link bundled references/*.md for lookup.

## Common mistakes
(Optional — omit if none observed.) What goes wrong, and the fix.
```

Assume the reader — a future agent — is already smart. Add only what it cannot recover from the
code and docs. Challenge each sentence: does it earn its tokens?

## Description (CSO — Claude Search Optimization): "Use when…" only

The `description` is the only thing an agent sees when deciding whether to load the skill. Write
it in third person, start with "Use when…", and list triggers and symptoms — not the workflow.

- Good: `Use when re-running the lattice simulation or reproducing a published figure.`
- Bad (summarizes workflow): `Reads config, sets the seed, runs sim.py, then plots.` — an agent
  may follow this and skip the body.
- Bad (vague): `Helps with the simulation.`

Include concrete terms an agent would search for: file names, task names, error strings.

## Naming

Claude Code skill names use lowercase letters, numbers, and hyphens only. Prefer verb-first and
specific: `regenerate-figure-3`, not `figures` or `helper`. Gerunds (`running-the-sweep`) are also
fine.

## Progressive disclosure

Keep the body lean; push detail into `references/*.md` linked from `SKILL.md`. Parameter tables,
API catalogs, and long rationale belong in references — an agent loads them only when needed. Keep
references ONE level deep (link every reference directly from `SKILL.md`); give any reference over
~100 lines a short table of contents.

## Token budget

Body under ~500 lines, ideally far less. Once loaded, every token competes with the agent's other
context. One excellent example beats three mediocre ones. Use consistent terminology — pick
"seed", not "seed"/"RNG state"/"random init" interchangeably.

## Self-review checklist

Run this against the produced SKILL.md (Step 9):

- [ ] `description` starts with "Use when…", third person, triggers only — no workflow summary.
- [ ] `name` is lowercase letters/numbers/hyphens, verb-first, specific.
- [ ] Body is lean; heavy reference and lookup content lives in `references/*.md`.
- [ ] References are one level deep from SKILL.md.
- [ ] At most one clear worked example, and it is concrete.
- [ ] Consistent terminology throughout.
- [ ] No narrative ("we discovered…"); it reads as a reusable guide.
- [ ] No time-sensitive claims (or quarantined in an "old patterns" note).
- [ ] Commands and paths are correct and use forward slashes.
