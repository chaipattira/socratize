# Testing the skill — RED, GREEN, REFACTOR

Reference for Steps 5, 7, and 8. A skill you never watched an agent try is a skill you cannot
trust. Test it the way you test code: watch it fail, make it pass, close the gaps.

**Core principle:** if you did not watch an agent fail WITHOUT the skill, you do not know the
skill teaches the right thing.

## RED: baseline before writing

Before drafting (Step 6), watch an unaided agent attempt the task the skill will cover. Dispatch a
fresh subagent into the repo with the representative task and NO skill. Give it read + execution
tools (`Read`, `Grep`, `Glob`, and `Bash` only when the task runs code). Record, verbatim, where
it stalls, guesses, or gets it wrong.

Separate the two kinds of failure — only one is teachable:

- **Knowledge gap** — a missing default, prerequisite, valid range, or procedure the agent could
  have applied if it had known it. This is exactly what the skill supplies.
- **Repo gap** — the code or data the task calls is absent from the repo (no `run.py`, no
  implementation behind a documented API). A skill cannot supply code that does not exist. STOP and
  report the gap to the user instead of drafting; do not try to author around it.

## The baseline recipe (docs-derived skills)

1. Pick ONE representative task the docs describe (e.g. "reproduce Figure 3", "run the sweep with
   the default config").
2. Write it as a concrete instruction, with real file paths, that forces the agent to act — not to
   recite.
3. Dispatch the subagent; have it return the steps it took, where it got stuck, and its output.
4. Collect the failure list: missing prerequisite, wrong default, unstated assumption, tribal
   knowledge it lacked.

## GREEN: draft to the failures

Write the skill to close THOSE specific failures — nothing speculative. Map the docs by type (see
`diataxis-to-skill-map.md`). Then dispatch a fresh subagent WITH the skill on the same task. It
should now succeed. If it still fails, the skill is unclear or incomplete — revise and re-run.

## REFACTOR: close gaps

Each remaining slip becomes a fix: a sharper step, a prerequisite made explicit, or a
`## Common mistakes` entry quoting what the agent got wrong. Re-run the verify subagent. Cap at 3
rounds; if gaps persist, record them under a `## Known limits` note and hand them to the user
rather than looping forever.

## When the skill is unnecessary

If the baseline agent succeeds WITHOUT the skill, the task needs no skill — report that and let the
user decide. Do not manufacture a skill for something an agent already does well. For a pure
lookup/reference skill, the RED and verify tasks are retrieval — confirm a subagent can find and
apply the facts; no adversarial pressure scenarios are needed.
