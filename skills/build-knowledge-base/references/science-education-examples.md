# Science & Education Examples

Worked micro-examples of each Diátaxis type applied to a research codebase. Use these as
tone/shape references when drafting. They are illustrative, not templates — the templates
live in `../templates/`.

## Tutorial (learning-oriented)

> **Title:** "Run your first simulation"
> Leads a new lab member from a clean checkout to a plotted result. First-person plural
> ("we will run..."), visible output after each step, minimal theory, links out to the
> explanation of the model rather than digressing. Success = the reader sees the same plot.

## How-to guide (task-oriented)

> **Title:** "How to reproduce Figure 3 from the paper"
> Assumes the environment is already set up. Numbered, imperative steps: which config,
> which seed, which command, where the output lands. Points to the config *reference* for the
> full parameter list instead of explaining each one.

## Reference (information-oriented)

> **Title:** "Model configuration reference"
> A table of every config key: name, type, default, units, valid range. Austere and
> lookup-structured; mirrors the config schema. Minimal example, no teaching.

## Explanation (understanding-oriented)

> **Title:** "Why we use a symplectic integrator"
> Discursive prose on the modelling choice, its assumptions, numerical trade-offs, and the
> alternatives considered. Readable away from the keyboard. Admits opinion; cites the paper.
