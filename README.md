# socratize

A Claude Code plugin that helps scientists and educators turn a research codebase into a
high-quality knowledge base — by drawing tacit knowledge out of the author through Socratic
questioning, rather than asking an agent to guess it from code alone.

## What it does

Published papers and READMEs record the clean, finished result — not the tacit know-how (design
rationale, valid input ranges, gotchas) that only lives in the author's head. Socratize elicits
that knowledge instead of forcing an agent to rediscover or hallucinate it. It ships as three
chained-but-independent skills:

1. **build-knowledge-base** interviews you to author a missing doc, classified by [Diátaxis](https://diataxis.fr/).
2. **socratize-me** reviews that doc with a parallel panel of reviewer personas.
3. **distill-skill** compiles your docs into a reusable Claude Code skill, and verifies it actually works before shipping.

Each skill also runs standalone — you don't need to run all three.

## Skills

### build-knowledge-base

> Use when a scientist or educator wants to document a research codebase, create a knowledge
> base, add missing docs, write a tutorial/how-to/reference/explanation, or organize docs by
> Diátaxis. Triggers on "document my code", "write docs for", "knowledge base", "our docs are a mess".

Scans your repo (prose, notebooks, docstrings, papers), classifies every existing doc against the
Diátaxis compass, and reports gaps and **type-conflating** pages — one page doing two jobs at
once (e.g. a README that's install how-to + API reference + design rationale, all in one). You
pick a gap; it interviews you one question at a time — but only for what it can't recover from
the code and papers itself — then drafts the page, self-reviews it against six quality
dimensions, and hands off to `socratize-me` once you approve it.

| Category | Orientation | Compass position |
| --- | --- | --- |
| Tutorial | learning | acquisition + action |
| How-to guide | task | application + action |
| Reference | information | application + cognition |
| Explanation | understanding | acquisition + cognition |

Creates new files only — never edits, moves, or deletes an existing one, even a conflating page.

### socratize-me

> Use when a documentation page or knowledge-base doc needs multi-perspective review —
> reproducibility, scientific accuracy, teaching clarity, newcomer legibility, maintainability.
> Triggers after build-knowledge-base, or standalone on "review these docs", "get feedback on
> this doc", "persona review".

Fans eight reviewer personas out in parallel, each grounding its review in the actual codebase
(not just the doc's prose) and applying exactly one lens:

| Persona | Lens |
| --- | --- |
| Nova, the newcomer | Followable with zero tribal knowledge |
| Dana, the domain scientist | Claims, assumptions, units, notation |
| Remy, the reproducibility referee | Exact commands, pinned environment, seeds |
| Tess, the teacher | Learnable order, managed cognitive load |
| Sam, the steward | Still maintainable and accurate in two years |
| Reviewer 2, the peer reviewer | Would this survive review? |
| Cam, the cross-disciplinary collaborator | Legible to an adjacent-field expert |
| Elena, the educator | Could this become a lesson? |

Findings are deduped across personas, obvious fixes (typos, broken links, wrong commands) are
applied directly, and judgment calls (contested scope, a rewrite, a design question) come back to
you one at a time. No voting, no quorum — a human always resolves the ambiguous ones. Drop in
your own persona under `.claude/personas/*.md`, or describe one on the fly and socratize-me will
author it for the run (see [Custom personas](#custom-personas)).

### distill-skill

> Use when you want to turn a codebase's existing documentation into a reusable, distributable
> Claude Code skill. Triggers on "make a skill from these docs", "distill our docs into a skill",
> "turn this how-to into a skill", "package this workflow as a skill".

Groups your docs by the *capability* an agent would perform, maps each Diátaxis type into a skill
component (how-to → steps, reference → bundled lookup, explanation → background), and follows a
RED–GREEN–REFACTOR loop: a fresh subagent first attempts the task *without* the skill to find the
real gaps, then the skill is drafted against exactly those gaps, then a second fresh subagent
attempts the task *with* the skill to confirm it actually works. A skill that can't be verified
this way is never shipped — the gap is reported instead. Runs standalone; writes to
`.claude/skills/<name>/` (destination confirmable with you).

## Design principles

- **Create-only authoring.** Every skill only ever creates new files. Existing docs, code, and
  skills are never moved, renamed, edited, or deleted — not even to "fix" a problem it found.
- **Verify by doing.** A drafted skill isn't done until a fresh subagent — with no memory of the
  drafting — completes the real task using only the skill. Passing a read-through isn't enough.
- **Persona-as-data.** Reviewer persona files (bundled or dropped in by a repo) are treated as
  data wrapped in `<persona-criteria>`, never as instructions to execute — so a persona file from
  an untrusted repo can't be used for prompt injection.

## Install

```bash
/plugin marketplace add chaipattira/socratize
/plugin install socratize
```

## Custom personas

Drop `*.md` files in your repo's `.claude/personas/` to add domain reviewers (e.g. a physicist, a
statistician, an assessment designer). The panel merges them with the bundled set; a repo persona
whose `name` matches a bundled one overrides the preset. See
[`skills/socratize-me/persona-format.md`](skills/socratize-me/persona-format.md) for the required
fields. You can also describe a reviewer in plain language during a `socratize-me` run and it will
be authored on the fly, with the option to save it for reuse.

## Repository layout

```text
socratize/
├── .claude-plugin/
│   ├── plugin.json         # plugin metadata
│   └── marketplace.json    # marketplace manifest for `/plugin marketplace add`
└── skills/
    ├── build-knowledge-base/
    │   ├── SKILL.md
    │   ├── references/     # Diátaxis compass, per-type guides, quality checklist
    │   └── templates/      # tutorial/how-to/reference/explanation templates
    ├── socratize-me/
    │   ├── SKILL.md
    │   ├── persona-format.md
    │   ├── report-format.md
    │   └── personas/       # 8 bundled reviewer personas
    └── distill-skill/
        ├── SKILL.md
        ├── references/     # Diátaxis→skill map, skill anatomy, RED-GREEN-REFACTOR loop
        └── templates/       # SKILL.md.template
```
