---
name: build-knowledge-base
description: Use when a scientist or educator wants to document a research codebase, create a knowledge base, add missing docs, write a tutorial/how-to/reference/explanation, or organize docs by Diátaxis. Triggers on "document my code", "write docs for", "knowledge base", "our docs are a mess".
---

# Build a Knowledge Base with the Socratic Method

Classify a research codebase's existing docs by Diátaxis, then CREATE the missing ones — drawing domain knowledge out of the author through targeted Socratic questioning.

## The Diátaxis foundation

Two compass questions place any content: is the reader **acting** or **cognizing**, and **acquiring** skill or **applying** it?

| Category | Orientation | Compass position |
| --- | --- | --- |
| Tutorial | learning | acquisition + action |
| How-to guide | task | application + action |
| Reference | information | application + cognition |
| Explanation | understanding | acquisition + cognition |

Detail: `references/compass.md` and the per-type guides `references/{tutorials,how-to-guides,reference,explanation}.md`.

## Step 1: Scan for documentation

Glob widely; read nothing yet.
- **Prose:** `README*`, `docs/`, `doc/`, `*.md`/`*.rst`/`*.adoc`/`*.txt`, wikis, doc config (`mkdocs.yml`, `conf.py`, `docusaurus.config.js`).
- **Notebooks:** `*.ipynb` — markdown cells only.
- **Docstrings / module headers:** light scan → candidate *reference*.
- **Papers:** `*.tex`, `*.pdf`.

Papers are read as **explanation-type context** only — never reclassified, moved, or edited.

## Step 2: Read and classify

Read each page, run the compass, assign ONE category. Present a table:

| File | Category | Notes |
| --- | --- | --- |

Flag **type-conflating** pages — one page doing two jobs (e.g. a README that is install how-to + API reference + design rationale at once).

## Step 3: Gap + conflation report

Report missing categories, conflating pages, and a CREATE-ONLY shortlist that factors in papers (e.g. "the method is explained in `paper.tex` but no how-to reproduces Figure 3").

<HARD-RULE>
Create new documents only. NEVER move, rename, delete, edit, append to, or rewrite existing files —
not even to "fix" a conflating page. Report conflation and propose a new page instead.
</HARD-RULE>

## Step 4: Choose what to create

Present the shortlist; the user picks one gap — or names something else.

## Step 5: Classify the new doc and load its reference

Determine the target type via the compass, then read its guide `references/{tutorials,how-to-guides,reference,explanation}.md` and template `templates/{tutorial,how-to,explanation,reference}.md`. See `references/science-education-examples.md` for a worked micro-example of the target type.

## Step 6: Socratic Q&A

Interview the author to fill the template's unknowns — but only what you truly cannot recover yourself.

## Answer your own questions first

Before asking the author anything, try to answer it from the code, existing docs, and
papers. Only surface genuine unknowns — design rationale, valid input ranges, assumptions
and limits, prerequisites, expected outputs, known gotchas. If you cannot ground an answer
in an artifact, it is an unknown — ask, never guess. Ask ONE question at a time,
multiple-choice with a recommended option, via AskUserQuestion.

## Step 7: Draft

Fill the loaded template, obeying that type's writing principles. Keep the draft in its lane — do not smuggle in a second type.

## Step 8: Self-review

Run `references/quality.md`: the 6 functional dimensions (accuracy, completeness, consistency, usefulness, precision, redundancy tolerance) and the 5 deep markers. Then check Diátaxis type-fit — did the draft stay in its lane, or leak a second type? Fix inline.

## Step 9: User review gate

Present the file. On requested changes, apply them and RE-RUN Step 8. Proceed only on the user's explicit approval.

## Step 10: Hand off

Once approved, offer the persona review using this exact wording:

> The knowledge-base page is approved. The recommended next step is a persona review. Shall I launch **socratize-me** on <absolute path to the new doc>?
