# Add Test Suites for Python Harness and Website Analysis

- **Date**: 2026-03-30
- **Status**: implemented
- **Type**: feature
- **Depends on**: plans 01-05 (assumes pure functions are extracted and state machine is injectable)

## Problem

The codebase has zero automated tests. Both the Python harness and the website's TypeScript analysis layer contain pure functions that are trivially testable in isolation. Without tests, refactors from plans 01-05 are risky to validate.

## Approach

Add pytest tests co-located in a `tests/` directory at the repo root for Python, and co-located `.test.ts` files next to the source for the website (following the Vitest convention). Configure pytest via `pyproject.toml`. Vitest is already configured via the existing `npm run website:test` script. Focus on edge cases and contract validation rather than line coverage.

The task description mentions `groupByVariant()` but that function does not exist — the actual function is `groupByExecutorAndJudge()`. Tests will target the real function names.

## Changes

| File | Change |
|------|--------|
| `pyproject.toml` | Add `[tool.pytest.ini_options]` section with `testpaths = ["tests"]` and `pythonpath = ["."]` |
| `tests/test_helpers.py` | Pytest tests for `extract_json()`, `level_name()`, `level_slug()`, `sum_token_usage()`, `make_env()` |
| `tests/test_state_machine.py` | Pytest tests for the extracted state machine (assumes plan 05 produced an injectable state machine class/functions). Tests round transitions, ascent/descent logic, failure conditions using mock executor/judge callables. |
| `tests/test_integration.py` | Integration tests for `call_claude()`, `run_executor()`, `run_judge()` using runner injection — verifies CLI flag assembly, prompt interpolation, response handling |
| `tests/test_analyze_snapshots.py` | Snapshot tests for `analyze_results.py` output formatting against known fixture data |
| `tests/snapshots/` | Stored snapshot `.txt` files for analyze output |
| `website/src/lib/analyze.test.ts` | Vitest tests for `discardErrorRuns()`, `computeStats()`, `groupByExecutorAndJudge()`, `pickFailureQuotes()`, `formatFailureStep()` |

## Test Details

### Python: `tests/test_helpers.py`

**`extract_json()`** — the most edge-case-rich function:
- Pure JSON string `'{"detected_level": 3, "reasoning": "..."}'` — parses directly
- JSON embedded in prose: `"Here is my analysis:\n{...}\nHope that helps"` — finds the block
- Multiple JSON blocks, only one with `detected_level` — picks the right one
- Malformed JSON — returns `None`
- Empty string — returns `None`
- Nested braces in reasoning string (the regex uses non-greedy `.*?` so this may fail for deeply nested objects — test to document the limitation)
- JSON with extra keys beyond `detected_level` — still returns it

**`level_name()`**:
- `level_name(0)` returns `"Skill"`
- `level_name(1)` returns `"Skill Creator"`
- `level_name(3)` returns `"Skill Creator Creator Creator"`

**`level_slug()`**:
- `level_slug(0)` returns `"skill"`
- `level_slug(1)` returns `"skill-creator"`
- `level_slug(3)` returns `"skill-creator-creator-creator"`

**`sum_token_usage()`**:
- Empty list — returns zeroed dict
- Steps with `None` usage — skipped gracefully
- Mixed steps (some with executor_usage, some with judge_usage, some with both) — sums correctly
- Partial token keys (e.g., missing `cacheCreationInputTokens`) — treated as 0

**`make_env()`**:
- Returns a dict without `CLAUDECODE` key even if it exists in `os.environ`
- Preserves other env vars
- Works when `CLAUDECODE` is not set (no KeyError)

### Python: `tests/test_state_machine.py`

This assumes plans 04-05 extracted the experiment loop into an injectable state machine. Tests will use mock/fake executor and judge callables:

- **Happy path**: mock executor always succeeds, mock judge always returns the expected level. Verify the run completes the expected number of rounds and steps.
- **Ascent failure**: judge returns wrong level on the first ascent. Verify run stops with correct failure metadata (round, step_index, expected vs detected level).
- **Descent failure**: passes ascent but judge returns wrong level during descent. Verify failure recorded at correct step.
- **Executor error**: executor returns an error dict. Verify graceful failure with `detected_level: -1`.
- **Judge error after retries**: judge always errors. Verify all retries are attempted, then failure recorded.
- **Multi-round success then failure**: passes rounds 1-2, fails on round 3 ascent. Verify `max_round` is 2 and step counts are correct.

The exact import paths depend on how plan 05 structures the extraction. The test file should import from wherever the state machine lands (likely `scripts/experiment/state_machine.py` or similar). If the state machine accepts executor/judge as callables, tests pass in lambdas/fakes. If it uses a protocol/ABC, tests create minimal implementations.

### TypeScript: `website/src/lib/analyze.test.ts`

Create a small `makeRun()` test helper that builds a `RunResult` with sensible defaults and selective overrides — avoids repeating the full 10-field object in every test.

**`discardErrorRuns()`**:
- Empty array — returns empty
- All clean runs (no failure) — returns all
- Mix of clean, mismatch-failure (detected_level != -1), and error-failure (detected_level == -1) — keeps clean and mismatch, discards error
- All error runs — returns empty

**`computeStats()`**:
- Single run, no failure — verify all stat fields
- Multiple runs with varying max_round — verify mean, median, max calculations
- Empty array — verify zeroed stats (no division by zero)
- Runs with only ascent steps vs mixed ascent/descent — verify direction counters
- Even number of runs — verify median uses average of two middle values

**`groupByExecutorAndJudge()`**:
- Single model — one group
- Multiple executor models, same judge — separate groups
- Missing `model`/`judge_model` fields — defaults to `"opus"`
- Same executor, different judges — nested map has separate entries

**`pickFailureQuotes()`**:
- No failed runs — returns empty array
- Fewer failed runs than requested count — returns what's available
- Multiple failures at different levels — picks evenly spaced samples
- `count = 1` — returns exactly one

**`formatFailureStep()`**:
- No failure — returns dash
- Ascent failure — returns `"ascent to level N"`
- Descent failure — returns `"descent N -> M"` format
- Failure step_index not found in steps — falls back to round display

## Configuration

### pyproject.toml additions

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

No extra dependencies needed — pytest is the only requirement, no mocking libraries beyond `unittest.mock` from the stdlib.

### Vitest

Already configured via `vitest` in devDependencies and `"test": "vitest run"` in package.json. The default Vitest config discovers `*.test.ts` files automatically. No vite.config changes needed — Vitest reads it by default. May need to add a `/// <reference types="vitest" />` to the test file or add vitest types to tsconfig if type errors occur.

### Python: `tests/test_integration.py`

Integration tests for `call_claude()`, `run_executor()`, and `run_judge()` using the runner injection point from plan 04. These test CLI flag assembly, prompt interpolation, and response handling without spawning real Claude processes.

**`call_claude()`**:
- Verify assembled CLI args include `--output-format json`, `--max-turns 10`
- Verify `CLAUDECODE` env var is stripped from subprocess env
- Verify temp file is written with prompt content and cleaned up
- Verify timeout handling produces error dict
- Verify JSON envelope parsing (success and malformed cases)
- Verify `--allowedTools` flag is passed through correctly

**`run_executor()`**:
- Verify prompt template interpolation (source_content, output_path placeholders)
- Verify success detection (output file exists check)
- Verify failure when executor doesn't create the expected file

**`run_judge()`**:
- Verify prompt template interpolation (content to judge)
- Verify judge retry logic on parse failures
- Verify correct passing of `--allowedTools` (judge gets none)

### Python: `tests/test_analyze_snapshots.py`

Snapshot tests for `analyze_results.py` output formatting. Creates a fixture directory with known result JSON files, runs the analysis, and asserts the printed output matches a stored snapshot.

- Happy path with 3 runs of varying depths — snapshot of full tabular output
- All-error runs — snapshot of error summary
- Mixed models — snapshot showing per-model breakdown
- Snapshot update mechanism: run with `--update-snapshots` flag or `UPDATE_SNAPSHOTS=1` env var to regenerate

Store snapshots in `tests/snapshots/` as `.txt` files.

## Out of Scope

- Testing React components — that's a separate effort
- Achieving any specific coverage percentage
- CI integration — that's a separate plan
