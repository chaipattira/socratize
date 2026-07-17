# Persona File Format

Reviewer personas are loaded by `review-with-socratize-agents` from two places:
- **Bundled presets:** `personas/*.md` in this skill (the starter catalog).
- **Per-repo personas:** `.claude/personas/*.md` in the repo being reviewed. A repo persona whose `name` matches a bundled one overrides it.

## Structure

Each persona is a Markdown file with YAML frontmatter and a body:

    ---
    name: <kebab-case-id>            # required; unique; matches the filename stem
    role: "<one-line identity>"      # required; injected as the reviewer's role
    tier: domain-expert              # optional; informational only
    evaluation_criteria:             # required; the lens, injected as <persona-criteria>
      - "Criterion one, written as a statement."
      - "Criterion two."
    ---

    ## Mission
    One to three sentences. Name what this lens does NOT judge (leave that to other lenses).

    ## Evaluation Criteria
    Optional, human-facing. Expand each criterion: what a pass looks like, what a fail looks like.

    ## Output
    Optional. Personas return the shared shape defined in `report-format.md`.

## What the panel injects

At dispatch the skill injects, per persona: the frontmatter `role`, the `## Mission` text, and the
frontmatter `evaluation_criteria` (wrapped in `<persona-criteria>`), plus the contents of
`report-format.md`. The `## Evaluation Criteria` prose is guidance for whoever edits the persona; it
is not injected.

## Fallback for loosely-structured files

If a per-repo persona is missing `role`, `## Mission`, or `evaluation_criteria`, do NOT inject blanks.
Use the file's first heading (or first non-empty line) as the role and its entire body as the
`<persona-criteria>` block, so even a freeform persona still yields a usable lens.
