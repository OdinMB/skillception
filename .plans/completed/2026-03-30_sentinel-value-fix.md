# Fix Sentinel Value Collision for detected_level: -1

- **Date**: 2026-03-30
- **Status**: implemented
- **Type**: bugfix

## Problem

When the judge response can't be parsed or the executor fails, `run_experiment.py` sets `detected_level: -1` in both the step's `judge_result` and the run's `failure` record. The website's `discardErrorRuns()` filters on `detected_level === -1`, but -1 could theoretically be a legitimate judge assessment. Error runs and genuinely-detected-minus-one runs are indistinguishable.

## Approach

Add an `"error"` boolean field to `Failure` records. Error-caused failures set `error: true`; normal mismatches set `error: false`. The `detected_level` in error cases becomes `null` (Python `None` / TypeScript `null`) since there was no actual detection. The website filters on the `error` field instead of the sentinel value.

For backward compatibility: existing result.json files have no `error` field and use `-1`. The website treats missing `error` field + `detected_level === -1` as an error run (legacy path).

**Alternatives considered:**
- *String sentinel like `"parse_error"`* -- breaks the numeric type of `detected_level`, requiring union types everywhere. More invasive.
- *Separate `is_error` field only, keep `-1`* -- still ambiguous in the data; `null` is more semantically correct for "no detection happened."

The chosen approach is minimal: one new boolean field, `null` for missing values, clean type narrowing.

## Changes

| File | Change |
|------|--------|
| `scripts/run_experiment.py` | In `run_judge_with_retries`: change `detected_level: -1` to `detected_level: None` in both error return paths (lines 244, 256). In `run_experiment`: change the four `"detected_level": -1` literals in failure records (lines 360, 386, 446, 471) to `None`, and add `"error": True` to those four failure dicts. Add `"error": False` to the two normal-mismatch failure dicts (lines 400, 485). |
| `website/src/types.ts` | Change `Failure.detected_level` from `number` to `number \| null`. Add `error?: boolean` to `Failure` (optional for backward compat). Change `JudgeResult.detected_level` from `number` to `number \| null`. |
| `website/src/lib/analyze.ts` | Update `discardErrorRuns` to filter on `r.failure.error === true` OR the legacy condition `(r.failure.error === undefined && r.failure.detected_level === -1)`. Update `pickFailureQuotes` description template to handle `null` detected_level (display "N/A" or "error"). |

## Tests

No existing test files for the website or harness. Manual verification:
1. Run `npm run website:typecheck` to confirm type changes compile.
2. Spot-check that existing result.json files (none have `-1`) still load correctly.
3. On next experiment run, verify error cases emit `null` + `error: true`.

## Out of Scope

- Migrating existing `runs/*/result.json` files to the new format (no files currently have `-1`, so this is moot).
- Adding unit tests for `analyze.ts` (good idea but separate task).
- Changing the `JudgeResult` inside step records -- those already carry the parsed value or `null` from the judge; the `detected_level: -1` issue is only in the `failure` record and the `run_judge_with_retries` return value. Actually, the step's `judge_result.detected_level` also gets `-1` indirectly via `judge_result["detected_level"]` -- this will become `None`/`null` naturally from the `run_judge_with_retries` change.
