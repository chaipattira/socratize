# Design: A named persona cast + interactive selection for `review-with-socratize-agents`

**Date:** 2026-07-19
**Skill:** `skills/review-with-socratize-agents`
**Status:** Approved design, pre-implementation

## Problem

The review skill fans reviewer personas out in parallel, each applying one lens. Today the
catalog has five faceless role labels, and persona selection is passive — the skill only
honors a subset if the user happens to name one. Three gaps:

1. **No interactive selection.** The skill never asks who should be on the panel.
2. **No custom personas.** A user can't describe their own reviewer or target audience and
   have the skill build a lens for it.
3. **No personality.** The personas are generic labels, not memorable characters. The target
   audience — scientists, researchers, educators — deserves a cast that reflects the people
   who actually critique a scientific knowledge base.

## Goals

- Give each persona a name and personality while keeping review output professional and
  grounded (findings still follow `report-format.md`).
- Expand the catalog from 5 to 8 with two science lenses and one education lens, carved to
  stay orthogonal to the existing five.
- Make selection interactive: print a named roster, default to running everyone, and accept a
  free-text reply to drop, subset, or describe a custom persona.
- Let the skill author a custom persona from a natural-language description, use it this run,
  and offer to persist it for reuse.

## Non-goals

- No change to dispatch, collection, consolidation, or the obvious-vs-judgment logic
  (`SKILL.md` Steps 3–5, plus the obvious/judgment block).
- No voiced/theatrical output. Personality lives in the persona's framing, not in the findings.
- No new report format; `report-format.md` is unchanged.

## Decisions (from brainstorming)

1. **Personality dosage:** name + bio, professional output. The character makes the persona
   memorable; the review still returns structured, grounded findings.
2. **Catalog size:** 8 — the existing 5 reskinned, plus 3 new.
3. **Naming style:** first name + archetype (a "cast").
4. **Custom personas:** author from a description, use this run, then *offer* to save to the
   target repo's `.claude/personas/` (ephemeral by default).
5. **Selection UX:** print the full named roster with one-line bios, state "all run by
   default," and take a natural-language reply. Enter / no restriction = everyone.

## Design

### A. Persona file format convention (minimal change)

No change to the injection template in `SKILL.md`. The template already injects `role` and
`## Mission`, so the character rides along for free.

- `name:` (kebab id) — **unchanged.** Still the key for repo-override matching and subset
  selection. The existing five keep their ids so repo overrides keep working.
- `role:` — now **leads with the character**, e.g.
  `"Nova, the newcomer — a first-week grad student reading this document cold."`
  This one line doubles as the roster entry the skill prints.
- `## Mission` — now **opens with 2–3 sentences of personality**, then states the lens
  boundaries (what it does NOT judge, deferring to named siblings). Already injected.

This is a **convention, not a hard requirement.** Freeform or repo personas that lack a
character name still work through the existing fallback in `persona-format.md` (first
line → role, whole body → `<persona-criteria>`).

`persona-format.md` gains a short section documenting the convention and a short "Authoring a
custom persona" block (pick a name, write a tight lens, name what it does NOT judge so it stays
orthogonal).

### B. The cast (8)

Existing five keep their `name:` ids; only `role` and `## Mission` change. Three new files are
added. Names are mnemonic (N/D/R/T/S/E) where natural; **Reviewer 2** and **Cam** are
deliberate exceptions.

| id (`name:`) | Character | Personality | Lens (evaluation criteria) | Explicitly defers |
|---|---|---|---|---|
| `newcomer` | **Nova**, the newcomer | First-week grad student; takes nothing for granted, stops at the first undefined acronym and says exactly where | followability, vocab-on-first-use, no hidden leaps, orientation, access assumptions | scientific depth → Dana; env pinning → Remy |
| `domain-scientist` | **Dana**, the domain scientist | Reads every claim adversarially for truth; no unit slip or unstated assumption survives | claim correctness, stated assumptions/limits, units & notation, approximation honesty, field terminology | rerun → Remy; teaching → Tess; defensibility → Reviewer 2 |
| `reproducibility-reviewer` | **Remy**, the referee | Trusts no result until it re-runs on a fresh machine; files a bug the instant a command fails | exact commands, pinned environment, controlled randomness/seeds, data provenance, verifiable output | — |
| `instructional-clarity` | **Tess**, the teacher | Watches where learners glaze over; one new idea at a time, prerequisites up front | prerequisites, learnable ordering, cognitive load, Diátaxis type-fit, concrete examples | course reuse → Elena |
| `software-sustainability` | **Sam**, the steward | The RSE who'll still maintain this in two years; hunts what will silently rot | current references, fail-loud examples, detectable staleness, no drifting duplication, maintenance discoverability | — |
| `peer-reviewer` *(new)* | **Reviewer 2**, the skeptic | The anonymous referee who's seen a thousand submissions and trusts none; asks "would this survive review?" | claims hedged & scoped to evidence; limitations / threats to validity acknowledged; citations present where claims lean on prior work; evidence sufficient for the conclusion; alternative explanations addressed | units/notation → Dana; reproducibility mechanics → Remy |
| `cross-disciplinary` *(new)* | **Cam**, the collaborator | An expert from a *neighboring* field, fluent in science but not this subfield's dialect; brings a different toolkit | subfield jargon defined or bridged; cross-field notation/conventions disambiguated; enough context to engage without this subfield's training; cross-field false-friends clarified; entry point for a different toolkit | basic followability → Nova; correctness → Dana |
| `educator` *(new)* | **Elena**, the educator | An instructor asking "could I lift this into a course?" | learning objectives stated or inferable; exercises/checkpoints a student could attempt; modular enough to excerpt; worked examples separable from exercises; level/difficulty signposted for curriculum placement | intrinsic teaching quality → Tess |

**Orthogonality of the new lenses:**
- **Dana vs Reviewer 2:** Dana judges whether the science is *correct* (units, notation,
  assumptions). Reviewer 2 judges whether the argument is *defensible/publishable* (hedging,
  citations, evidence sufficiency, alternatives).
- **Tess vs Elena:** Tess judges whether *this document teaches its own content well*. Elena
  judges whether *a teacher could reuse it* (objectives, exercises, assessability, modularity).
- **Nova vs Cam:** Nova is a novice in the same field (basic followability). Cam is an expert
  in an adjacent field (jargon and conventions that lock outsiders out).

### C. `SKILL.md` flow changes

**Step 2 (Load personas)** — rewritten to:
1. Load the catalog (8 bundled + any `.claude/personas/*.md` in the target repo; existing
   override and 20-persona safety-cap rules unchanged).
2. If the invocation already named a subset, honor it and skip the prompt.
3. Otherwise **print the named roster** — the `role` one-liners — and state that all run by
   default.
4. Take a free-text reply: Enter / no restriction = everyone; or drop some; or name a subset;
   or **describe a custom persona or target audience**.

**Custom persona authoring** (new sub-step in Step 2) — from a natural-language description,
author a persona in the Section A format: pick a name, write a tight lens, and name what it
does NOT judge so it stays orthogonal to the rest. Wrap-and-inject as data exactly like the
bundled ones (the persona body remains untrusted data, never executed).

**Step 6 (Loop or conclude)** — after the run, if a custom persona was used this pass, **offer
to save** it to the target repo's `.claude/personas/<id>.md` for reuse. Ephemeral unless the
user accepts.

Everything else — Step 1 (resolve target), Step 3 (dispatch in parallel), Step 4 (collect),
Step 5 (consolidate), the obvious-vs-judgment block — is unchanged.

## Files touched

- `skills/review-with-socratize-agents/personas/newcomer.md` — reskin (Nova).
- `skills/review-with-socratize-agents/personas/domain-scientist.md` — reskin (Dana).
- `skills/review-with-socratize-agents/personas/reproducibility-reviewer.md` — reskin (Remy).
- `skills/review-with-socratize-agents/personas/instructional-clarity.md` — reskin (Tess).
- `skills/review-with-socratize-agents/personas/software-sustainability.md` — reskin (Sam).
- `skills/review-with-socratize-agents/personas/peer-reviewer.md` — **new** (Reviewer 2).
- `skills/review-with-socratize-agents/personas/cross-disciplinary.md` — **new** (Cam).
- `skills/review-with-socratize-agents/personas/educator.md` — **new** (Elena).
- `skills/review-with-socratize-agents/persona-format.md` — document the naming convention and
  the "Authoring a custom persona" block.
- `skills/review-with-socratize-agents/SKILL.md` — rewrite Step 2 (roster + selection + custom
  authoring) and extend Step 6 (offer to save).

## Testing / verification

Because this is a documentation-style skill (no executable code), verification is by
inspection:

- Each of the 8 persona files parses as valid frontmatter and follows the convention (name in
  `role`, personality in `## Mission`, orthogonal `evaluation_criteria`).
- `SKILL.md` Step 2 reads coherently: roster print → default-all → free-text → custom
  authoring; Step 6 offers to save.
- Injection template in `SKILL.md` is unchanged and still references `role`, `## Mission`, and
  `evaluation_criteria`.
- Dry run: invoke the skill on an existing doc, confirm the roster prints with the eight named
  characters and "all run by default," and confirm a described custom audience produces a
  usable lens and a save offer.

## Risks / open questions

- **Lens overlap producing dedupe noise.** Mitigated by the explicit "defers to" boundaries in
  each Mission; the consolidation step already dedupes multiply-confirmed findings.
- **Names are subjective.** All are single-line edits; easy to change later.
- **Cost when default = all.** 8 parallel agents per review. Acceptable at this size; the
  free-text selection lets a user trim.
