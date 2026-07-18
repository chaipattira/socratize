---
name: distill-skill
description: Use when you want to turn a codebase's existing documentation into a reusable, distributable Claude Code skill. Triggers on "make a skill from these docs", "distill our docs into a skill", "turn this how-to into a skill", "package this workflow as a skill".
---

# Distill a Skill from Docs

Turn existing docs into a distributable Claude Code skill (a `SKILL.md` + optional references) a
future agent loads to do a repeatable task. Follow the writing-skills discipline: watch an unaided
agent fail, then write the skill to close those gaps. The result must be **verified by a subagent
that actually does the task**, not just drafted.

References: `references/diataxis-to-skill-map.md` (mapping), `references/skill-anatomy.md`
(structure + CSO), `references/testing-skills.md` (the RED-GREEN-REFACTOR loop).

<HARD-RULE>
Create only. Never move, rename, delete, or rewrite the source repo's files — you only ever create
the new skill directory (confirm its destination with the user; it may live outside the source
repo). Never ship a skill whose steps you could not verify against the repo; report the gap instead.
</HARD-RULE>

## Step 0 — Understand the request
If the user named a specific skill to build, go to Step 4. Otherwise scan and suggest.

## Step 1 — Scan for docs
Glob widely, then read: prose (`README*`, `docs/`, `*.md/.rst/.adoc/.txt`), notebook markdown
cells, a light docstring scan. Papers (`*.tex`, `*.pdf`) are explanation-context only.

## Step 2 — Classify and map to candidates
Diátaxis-classify each doc, then group docs by the *capability* an agent would perform (not one per
file). Present a suggestion table:

| Candidate skill | What an agent could DO | Source docs | Diátaxis roles |
| --- | --- | --- | --- |

Favor how-to + reference clusters. List non-groundable docs (papers, empty stubs, explanation-only
clusters) as flagged rows marked "— not a skill", not as candidates. If nothing is groundable, say
so — do not invent a skill.

## Step 3 — User picks
The user picks one candidate, or names their own. Never pick silently and proceed on your own.

## Step 4 — Define job + triggers
State what an agent should DO after loading the skill, and *when* to reach for it (the "Use when…"
triggers). Answer from the code and docs first; ask the author only for genuine unknowns — one at a
time, multiple-choice with a recommendation, via `AskUserQuestion`.

## Step 5 — RED: baseline
Load `references/testing-skills.md`. Dispatch a fresh subagent to attempt the task WITHOUT the skill
(`Read, Grep, Glob`; add `Bash` only if it runs code). Record where it fails, then split the
failures per the reference: a *knowledge gap* is what the skill supplies; a *repo gap* (the code or
data the task calls is absent) a skill cannot fix — STOP and report, do not draft. If the baseline
already succeeds, the skill may be unnecessary — report and let the user decide.

## Step 6 — GREEN: draft
Load `references/skill-anatomy.md`, `references/diataxis-to-skill-map.md`, and
`templates/SKILL.md.template`. Draft the skill against the Step 5 knowledge gaps, distilling by type
(how-to→steps, reference→bundled file, explanation→short "why", tutorial→one example). Put
documented gotchas in the relevant step; reserve `## Common mistakes` for observed failures (omit if
none). Write a CSO description (triggers only) and a lean body. Confirm the destination with the
user — default `<repo>/.claude/skills/<name>/` — and write the skill directory there.

## Step 7 — Verify
Dispatch a fresh subagent WITH the skill to redo the task. It must actually complete it. If the
task calls code or data absent from the repo, the skill cannot be verified — STOP and report it;
never ship an unexecutable skill.

## Step 8 — REFACTOR
Turn each remaining slip into a fix: a sharper step, an explicit prerequisite, or a
`## Common mistakes` entry quoting what the agent got wrong. Re-run Step 7. Cap at 3 rounds; record
leftovers under `## Known limits` and surface them.

## Step 9 — Self-review
Run the full checklist in `references/skill-anatomy.md` (CSO description, legal name, lean body,
one-level references, no narrative, and the rest). Fix inline.

## Step 10 — User review gate
Present the produced skill directory. On requested changes, apply them and re-run Steps 8–9.
Proceed only on explicit approval.

## Step 11 — Conclude
Report where the skill lives (`.claude/skills/<name>/`) and how to use or share it. Standalone —
no auto-handoff.

## Common mistakes
- **Picking a skill silently.** Show the Step 2 table and let the user choose; never pick and
  proceed alone.
- **Writing before watching it fail.** Drafting then testing derives troubleshooting from the docs,
  not from observed failure. RED (Step 5) before GREEN (Step 6).
- **Shipping an unexecutable skill.** A skill can read perfectly yet be unrunnable — its steps call
  a `run.py` or `integrate()` absent from the repo. If Step 7 can't complete the task, report the
  gap; never mark it done.
- **Summarizing the workflow in `description`.** Triggers only; a summary makes agents skip the
  body.
