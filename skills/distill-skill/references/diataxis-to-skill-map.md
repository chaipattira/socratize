# Mapping Diátaxis docs to a skill

Reference for Step 2 (suggest candidates) and Step 6 (draft). A Claude Code skill is agent-facing:
a reference guide for a repeatable task. The four Diátaxis types feed it unevenly.

| Diátaxis source | Role in the produced skill | How to distill |
|---|---|---|
| **How-to guide** | The numbered steps — the core | Lift the procedure; strip narration; make each step imperative and verifiable. |
| **Reference** | A bundled `references/*.md` for lookup | Move parameter tables, APIs, and catalogs out of the body; link from SKILL.md. |
| **Explanation** | Background / rationale | Compress to a short "Why / when" note; never let it become the bulk. |
| **Tutorial** | Optional worked example | One end-to-end example; do NOT turn learning scaffolding into the steps. |

## Group by capability, not by file

A skill covers ONE capability an agent would perform — not one source doc. Cluster the docs around
that capability: the how-to becomes the steps, its reference doc becomes a bundled lookup file, and
the relevant explanation becomes a two-line "why". A single skill often draws on three source docs
of different types.

## Explanation-only clusters are background, not a skill

If a candidate is backed only by explanation or tutorial prose — with no procedure or lookup an
agent could act on — it is background for some future skill, not a skill itself. Flag it in the
suggestion table; do not force a weak skill.

## What does NOT become a skill

Papers (`*.tex`, `*.pdf`) are read as explanation-context only — never the basis of a skill.
Narrative, changelogs, and design diaries are not skills.
