---
name: model-codebase
description: Use when a codebase or pipeline needs explaining top-down, drilling from a high-level description down to the code itself. Triggers on "explain this codebase in layers", "architecture walkthrough", "onboarding docs for this repo", "document how this pipeline/model implementation works", "give me a layered breakdown of this repo".
---

# Model a Codebase in Layers

Each level is a **drill-down** into the level above it: one level states *what* exists, the next
level down states *how* — until "how" bottoms out at a link to real code. Every doc should make
the reader ask "how does that work?" and the next level down should be the answer.

For Diátaxis-categorized docs (tutorial/how-to/reference/explanation) instead of an architecture
drill-down, use `build-knowledge-base` instead.

<HARD-RULE>
Create only. Never move, rename, delete, edit, append to, or rewrite existing repo files — you
only ever create new files under `docs/architecture/`.

Never fabricate logic. A component's deep-dive must be grounded in code that actually exists. If
a component has no implemented logic (empty notebook, unbuilt stub, doc describing an API that
isn't there), say so plainly. Any inference beyond what's on disk goes in its own clearly labeled
subsection — never blended into prose that reads as fact.
</HARD-RULE>

## Step 0 — Gather inputs, source vs. context

Read every file in the codebase. Completion criterion: you can name every **source component**
(code that does something) and, for each, say in one sentence what it does. If you can't yet,
keep reading.

Sort what you read into two piles:
- **Source components** — modules, scripts, notebooks, configs consumed by code. Each gets its
  own Level 3 file in Step 3, whether or not it currently has any code in it (an empty notebook
  is still a notebook — Step 3 covers what to write when there's nothing implemented yet).
- **Context** — READMEs, papers, design docs, prose. These inform the Level 1 problem statement
  and any gap notes but never get their own component deep-dive (a README isn't a component just
  because it's the only file with prose in it). Build artifacts (`__pycache__`, `.pyc`, `dist/`,
  lockfiles) are neither — skip them, don't document them.

**Research first.** Try to derive the one-paragraph problem statement from context + code before
asking anyone. If genuinely unrecoverable — no README, no docstrings, no paper abstract that says
what the thing is for — ask ONE question via AskUserQuestion: offer your best synthesized draft
as the recommended option alongside "something else." Don't invent a confident-sounding paragraph
and present it as given fact; if you had to synthesize it, say so in the doc.

## Step 1 — Level 1: overview

Write `docs/architecture/00-overview.md`: the problem title as a heading, the problem description
(synthesized or given), and nothing else — state the *what*, not the *how*.

If context and code disagree (a README describes a CLI or function that doesn't exist, a paper
claims behavior the code doesn't implement), record it here as a short "Known gaps" section. This
is the ONE place gaps live — later files link back to it instead of repeating the explanation.

## Step 2 — Level 2: component map

Write `docs/architecture/01-components.md`: one list, every **source** component, each with a
short paragraph (3–5 sentences) on what it does and what it depends on. Completion criterion:
every source component from Step 0 maps to exactly one entry here — nothing left uncovered,
nothing invented that isn't in the code. Component names here must exactly match the filenames
used in Step 3: drop the source extension (`config.py` → `config.md`, `sim.ipynb` → `sim.md`); if
that would collide two components, use the relative path with `/` replaced by `-` instead.

## Step 3 — Level 3: one file per component

For each component in `01-components.md`, write `docs/architecture/components/<component-name>.md`:

- What it does and why it exists (longer version of its Level 2 paragraph).
- Pseudocode or a short snippet illustrating its core logic — quoted or paraphrased from what's
  actually on disk.
- A relative markdown link to the real source file(s).

**If a component has no real logic yet** (empty notebook, bare constants with no consumer, an
unbuilt stub): say exactly that — quote what's there in full if it's short. If you want to
hypothesize what it's probably for, put that under a separate `## Inferred, not implemented`
heading, reasoning explicitly from filename/title/sibling files — never write speculative
pseudocode as though it were the component's actual logic.

Completion criterion: every Level 2 component has a corresponding file — no gaps, no orphans.

## Step 4 — Drill down further where needed

If a component is complex enough to have sub-parts worth explaining separately, recurse: turn its
Level 3 file into a mini Level 2 (short intro + list of sub-components), and give each sub-component
its own file one directory level deeper:
`docs/architecture/components/<component-name>/<subcomponent-name>.md`.

Stop drilling when a component is simple enough that its Level 3 file's code link *is* the next
honest level of detail. A flat pipeline should produce a flat `components/` folder — don't force
nesting where the code has none.

## Step 5 — Self-review

Check, and fix inline:
- **Fabrication** — every pseudocode block traces to real code; every inference is under its own
  labeled heading, not blended into factual prose.
- **Redundancy** — each gap/contradiction is explained once (Step 1), everywhere else links back
  to it rather than re-explaining.
- **Coverage** — every Level 2 entry has exactly one Level 3 file, and vice versa.
- **Links** — every leaf file ends in a working relative link to real source.
- **Depth** — no branch nested deeper than the code's actual complexity warrants.

## Step 6 — User review gate

Present the file tree you created. On requested changes, apply them and re-run Step 5. Proceed
only on the user's explicit approval.

## Output structure

```
docs/architecture/
├── 00-overview.md          # Level 1
├── 01-components.md        # Level 2
└── components/
    ├── <component-a>.md    # Level 3 leaf, or...
    └── <component-b>/      # ...Level 3 branch, if it warrants Level 4
        ├── <sub-b1>.md
        └── <sub-b2>.md
```

## Common mistakes

- **Writing a component doc for a README or paper.** These are context for the overview and gap
  notes, not components — they didn't write any code.
- **Inventing pseudocode for an empty file.** An empty notebook or unbuilt stub gets "there's no
  implemented logic here" plus, if useful, a clearly separated `## Inferred, not implemented`
  guess — never prose that reads as describing real behavior.
- **Explaining the same docs/code mismatch three times.** State it once in `00-overview.md`'s
  "Known gaps"; link to it elsewhere instead of repeating the explanation.
- **Asking the user before checking context.** Try README, docstrings, paper abstract, config
  comments first. Ask only when truly unrecoverable, and offer your synthesized draft as the
  recommended option.
