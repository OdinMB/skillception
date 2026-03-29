# Meta-Skill Recursive Experiment (Option C: Dual-Agent Blind Validation)

- **Date**: 2026-03-28
- **Status**: completed
- **Type**: feature

## Problem

We want to empirically measure how many layers of meta-recursive skill creation Claude can maintain before coherence breaks down. "Create a skill that creates skills that create skills that create skills..." — at what depth does the telephone game fail? We need a repeatable, automated harness that can run 100+ trials and produce aggregate statistics.

## Approach

Three-component architecture using `claude -p` CLI for all AI invocations:

1. **Executor** — a prompt template (plain Markdown, no frontmatter — NOT a registered Claude Code agent) that the harness reads and interpolates into `claude -p` prompts. Receives: source SKILL.md content + target description. The harness pre-creates the output directory and tells the executor to write the result there.
2. **Judge** — a prompt template (same: plain Markdown, not a registered agent) that receives a SKILL.md blind and must determine its meta-level. Returns structured JSON.
3. **Python harness** — orchestrates executor and judge via `claude -p` subprocess calls, manages the ascent/descent cycle, compares judge verdicts to expected levels, logs results.

### CLI invocation details

Every `claude -p` call must:
- Strip `CLAUDECODE` env var (prevents "recursive invocation" guard)
- Use `--output-format json` to get structured response with `.result` field and `.usage` metadata
- Pass `--allowedTools Write,Bash` for executor calls (needs Write for SKILL.md, Bash for mkdir)
- Pass `--max-turns 10` to prevent runaway tool loops
- Use `subprocess.run` (not `Popen` + `select.select`, which fails on Windows pipes)
- Set `cwd` to project root so Claude Code discovers the `.claude/` config

For the judge, content is piped via stdin to avoid shell quoting/length issues:
`echo <content> | claude -p "analyze this skill..." --output-format json`

JSON extraction from judge: parse the outer envelope's `.result` field, then extract the JSON object from the text (handle potential surrounding prose with regex fallback).

### Meta-level definitions

- Level 0 = **Skill Creator (SC)**: creates arbitrary skills
- Level 1 = **Skill Creator Creator (SCC)**: creates skill-creator skills
- Level N = **SC^(N+1)**: creates skills of level N-1
- Name pattern: "Skill" + " Creator" × (N+1)

### Experiment sequence per run

Each run proceeds in **rounds**. Round R:
- **Ascent**: Use the current level-0 skill to create a level-(R+1) skill (1 step)
- **Descent**: Cascade from level R+1 down to level 0, each skill creating the one below it (R+1 steps)

Round 0: SC₀→SCC, SCC→SC₁ (2 steps)
Round 1: SC₁→SCCC, SCCC→SCC₂, SCC₂→SC₂ (3 steps)
Round R: R+2 steps

A run **fails** when the judge's detected level doesn't match the expected level for any step. On ascent failure, the entire round is aborted (don't attempt descent with a bad artifact). The run records: max round completed, failing step, failure mode.

### Step 0 bootstrap

The bootstrap skill-creator SKILL.md path is a CLI argument to the harness (default: resolve from `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator/SKILL.md`). The harness validates this file exists before starting.

### Alternatives considered

- **Full skill-creator invocation** for step 0: Authentic but far too slow/expensive for 100 runs. Rejected.
- **Anthropic SDK instead of CLI**: Loses Claude Code's tool environment. Rejected — executor needs Write tool.
- **Single-agent (no blind judge)**: Confirmation bias risk. Rejected in favor of Option C's rigor.

## Changes

| File | Change |
|------|--------|
| `agents/executor.md` | **New.** Plain Markdown prompt template (no YAML frontmatter). Instructions for generating a SKILL.md given a source skill and target description. Includes: what a valid SKILL.md looks like, how to derive instructions from the source skill, where to write the output. |
| `agents/judge.md` | **New.** Plain Markdown prompt template. Instructions for blind meta-level detection. Defines the level taxonomy, asks for structured JSON output: `{"detected_level": N, "reasoning": "..."}`. |
| `scripts/run_experiment.py` | **New.** Single-run orchestrator with `--runs N` flag for batch mode. Implements: round-based ascent/descent loop, executor invocation (pre-creates dirs, calls `claude -p` with `--allowedTools Write,Bash`), judge invocation, JSON parsing with fallback extraction, result logging. Uses `subprocess.run` (Windows-compatible). Strips CLAUDECODE env var. |
| `scripts/analyze_results.py` | **New.** Reads all result JSONs from `results/`. Prints to stdout: distribution of max rounds reached, failure mode breakdown by level, step-level success rates, summary statistics. |
| `.gitignore` | **New.** At repo root. Ignores `results/`, `generated-skills/`. |

## Result schema

Each run produces `results/{run_id}.json`:

```json
{
  "run_id": "uuid",
  "timestamp": "ISO8601",
  "max_round": 2,
  "total_steps": 7,
  "steps": [
    {
      "step_index": 0,
      "round": 0,
      "direction": "ascent",
      "source_level": 0,
      "target_level": 1,
      "source_path": "bootstrap",
      "output_path": "generated-skills/run-{uuid}/step-00-level-1/SKILL.md",
      "judge_result": {"detected_level": 1, "reasoning": "..."},
      "expected_level": 1,
      "passed": true
    }
  ],
  "failure": null
}
```

Token and duration data is extracted from the `--output-format json` envelope's `.usage` field when available, stored as optional fields (`executor_tokens`, `judge_tokens`).

## Tests

No automated test suite — this is itself an experiment harness. Manual validation:
- Single run: `python scripts/run_experiment.py` — verify it completes at least round 0
- Batch: `python scripts/run_experiment.py --runs 3` — verify 3 result JSONs appear
- Analysis: `python scripts/analyze_results.py` — verify readable output
- Inspect a generated SKILL.md to confirm structural validity

## Out of Scope

- No eval/grading loop from the real skill-creator (one-shot generation)
- No description optimization or packaging
- No UI/viewer — JSON + terminal output only
- No retry logic (failure = data point)
- No README (the plan is the documentation)
- No `batch_run.py` (merged into `run_experiment.py --runs N`)
