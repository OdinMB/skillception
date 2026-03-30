# Skillception

This repo is an experiment harness, not a library or application. It tests how many layers of meta-recursive skill creation Claude can maintain.

## Tone

This is a humor project. The README is written in a dry, self-aware comedic voice — treat the whole thing as a fun experiment that happens to be rigorous, not a serious benchmark that happens to be funny. Match that tone in any writing (docs, commit messages, comments). Keep it light.

## What this repo does

The harness runs a recursive loop where each step calls `claude -p` twice: once for an **executor** (generates a SKILL.md) and once for a **judge** (blindly evaluates what meta-level that SKILL.md targets). A run proceeds in rounds of ascending meta-level then cascading back down, stopping on the first mismatch between expected and detected level.

## Key files

- `agents/executor.md` — prompt template interpolated into executor's `claude -p` call. Not a registered Claude Code agent — plain Markdown read by the Python harness.
- `agents/judge.md` — prompt template for the judge. Same pattern.
- `scripts/run_experiment.py` — main harness. Orchestrates `claude -p` subprocess calls, manages the round-based loop, logs results as JSON.
- `scripts/analyze_results.py` — reads result JSONs from `runs/`, prints aggregate statistics.

## Architecture decisions

- Each `claude -p` call strips the `CLAUDECODE` env var to avoid the recursive-invocation guard.
- The executor gets `--allowedTools Write` only. The harness pre-creates output directories.
- The judge gets no tools — just text analysis returning JSON.
- `--max-turns 10` caps each call to prevent runaway loops.
- `--output-format json` returns a `{"result": "...", "usage": {...}}` envelope.
- Windows paths are converted to forward slashes before embedding in prompts.

## Style

This repo has a visual identity defined in `.claude/skills/skillception-style/SKILL.md`. Consult it before creating any visual or written assets. The short version: everything is styled as a formal academic paper from a fictional department. The humor is in the contrast between the serious presentation and the absurd content. Never explain the joke.

## Runtime directory (gitignored)

- `runs/` — one subdirectory per run, each containing `result.json` and `skills/` with generated SKILL.md files organized by step
