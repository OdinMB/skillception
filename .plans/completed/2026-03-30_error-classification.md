# Granular Error Classification + Judge Indeterminate Support

- **Date**: 2026-03-30
- **Status**: implemented
- **Type**: feature

## Problem

The `error` field on failure records is boolean — it can't distinguish *how* a technical failure occurred (timeout vs parse failure vs rate limit). Separately, the judge has no sanctioned way to say "indeterminate" — if the judge returns -1, the harness treats `detected_level is None` as an error because the old sentinel collides with legitimate incoherence findings. We need: (1) the judge's -1 to flow through as a real value (legitimate outcome, run kept), and (2) technical errors to record their category so we can debug.

## Approach

Change `Failure.error` from `bool` to `false | "call" | "parse"`:

- `false` — no technical error. Either a level mismatch or judge returned -1 (indeterminate). Both are legitimate outcomes.
- `"call"` — `call_claude` failed: timeout, non-zero exit code, rate limit. The subprocess didn't produce usable output.
- `"parse"` — `call_claude` succeeded but `extract_json` couldn't find valid JSON in the response. The model responded but we couldn't extract structured data.

The judge prompt already tells the judge to return -1 for incoherent skills (line 33 of `agents/judge.md`). No prompt change needed — -1 is already a documented value. The fix is entirely in how the harness classifies failures: -1 as `detected_level` means `error: false` (legitimate), while `None` means either `"call"` or `"parse"`.

**Alternatives considered:**
- *String enum with more categories (e.g. "timeout", "exit_code", "rate_limit")* — too granular for now, and we'd need to parse stderr to distinguish them. The call/parse split captures the meaningful diagnostic boundary. Can refine later if needed.
- *Separate `error_type` field alongside boolean `error`* — adds a field instead of widening one. More backward-compat friendly but adds schema complexity for no real benefit since we're already breaking the boolean contract.

## Changes

| File | Change |
|------|--------|
| `scripts/run_experiment.py` | In `_make_failure`: change `is_error: bool` param to `error: Literal[False, "call", "parse"]`. In `run_rounds()`: executor failures → `error="call"`, judge failures where `detected_level is None` → determine `"call"` vs `"parse"` from judge result's `error` string (if it starts with "could not parse" → `"parse"`, else → `"call"`). Judge returns -1 → `error=False` (legitimate mismatch). |
| `scripts/run_experiment.py` (`_run_step`) | No change needed — `_run_step` already passes through `detected_level` and `error` from the judge. The classification happens in `run_rounds()`. |
| `scripts/run_experiment.py` (`run_judge`) | Already returns `error: str` describing the failure. No change needed — the caller inspects the string to classify. |
| `scripts/result_schema.py` | `Failure.error`: change from `bool` to `bool \| str`. Update `_validate_failure` to check `error` is `False`, `"call"`, or `"parse"` (or absent for legacy). Update `generate_types_ts()` Failure interface. |
| `scripts/analyze_results.py` | `is_error_run()`: check `error` is a truthy string (`"call"` or `"parse"`), or legacy `-1` path. `error_failures` filter: same logic. |
| `website/src/types.ts` | `Failure.error`: change from `boolean` to `false \| 'call' \| 'parse'` (optional for legacy). |
| `website/src/lib/analyze.ts` | `discardErrorRuns`: filter where `error` is a string (truthy), or legacy path. `pickFailureQuotes`: update description for null detected_level to show error type. |
| `website/src/lib/analyze.test.ts` | Update test cases: `error: true` → `error: "call"` or `error: "parse"`. Add test for `error: false` with `detected_level: -1` (kept, not discarded). |
| `tests/test_state_machine.py` | Update assertions: `error is True` → `error == "call"` or `error == "parse"`. Add test for judge returning -1 (indeterminate) — should have `error: False`, not be treated as error. |
| `tests/test_helpers.py` | Add test for `extract_json` with `detected_level: -1` — ensure it parses correctly. |

## Tests

**Python (pytest):**
- `test_state_machine.py`: Update existing assertions from `is True`/`is False` to string/False checks. Add new test: judge returns -1 for indeterminate skill → `failure.error` is `False`, `failure.detected_level` is `-1`.
- `test_helpers.py`: Add `test_detected_level_negative_one` — `extract_json` with `{"detected_level": -1, ...}` returns the object with -1 intact.

**TypeScript (vitest):**
- `analyze.test.ts`: Update `error: true` → `error: "call"`. Add test for `error: false, detected_level: -1` (kept). Add test for `error: "parse"` (discarded).

## Out of Scope

- Migrating existing `runs/*/result.json` files — the legacy path handles them.
- Adding more granular call error categories (timeout vs rate limit vs exit code) — the `reasoning` field already captures the detail string.
- Changing the judge prompt — it already documents -1 for incoherent skills.
- Changing `ClaudeResponse.error` or `run_judge`'s return shape — those already carry descriptive strings that the caller can classify.
