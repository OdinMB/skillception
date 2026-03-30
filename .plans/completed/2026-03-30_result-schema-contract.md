# Result Schema Contract

- **Date**: 2026-03-30
- **Status**: implemented
- **Type**: refactor

## Problem

Three files independently agree on the shape of `result.json` with zero enforcement: `run_experiment.py` builds dicts inline, `analyze_results.py` reads them by string key, and `website/src/types.ts` declares interfaces by hand. A field rename or addition in one file silently breaks the others.

## Approach

Define the schema once as a Python TypedDict in a new `scripts/result_schema.py` module, validate at write and load time using a lightweight validation helper (no new dependencies -- just a stdlib-based check against the TypedDict), and add a CI-style script that verifies `types.ts` stays consistent with the Python schema.

TypedDict over JSON Schema because: (a) the harness is Python-only, so TypedDict gives type-checker support for free; (b) JSON Schema would require either a dependency (`jsonschema`) or a hand-rolled validator; (c) this is a small experiment harness, not an API contract between teams.

For the TS sync check: a small Python script generates the expected `types.ts` content from the TypedDict and diffs it against the actual file. This runs as a CI check or manual `npm run website:check-types` command. No build-time code generation -- the file stays hand-editable, but the check catches drift.

## Changes

| File | Change |
|------|--------|
| `scripts/result_schema.py` (new) | Define `TokenUsage`, `JudgeResult`, `StepRecord`, `Failure`, `RunResult` as TypedDicts. Include a `validate_result(data: dict) -> None` function that checks required keys and basic types (raises `ValueError` on mismatch). Include a `generate_types_ts() -> str` function that emits the equivalent TypeScript interfaces. |
| `scripts/run_experiment.py` | Import `validate_result` from `result_schema`. Call it on the result dict just before writing `result.json` (around the existing `json.dump` call near the end of `execute_run`). This catches schema drift at write time. |
| `scripts/analyze_results.py` | Import `validate_result` from `result_schema`. Call it in `load_results` after parsing each JSON file. Log a warning and skip invalid results (same pattern as the existing `JSONDecodeError` handling). |
| `scripts/export_results.py` | Import `validate_result` from `result_schema`. Call it in `load_and_clean` after parsing, before stripping paths. Warn and skip invalid results. |
| `scripts/check_types_sync.py` (new) | Script that calls `generate_types_ts()` and compares it to `website/src/types.ts`. Exits 0 if they match, 1 with a diff if they don't. Only compares the interfaces that come from result data (`RunResult`, `Step`, `Failure`, `JudgeResult`, `TokenUsage`) -- leaves `GroupStats` alone since that's a website-only computed type. |
| `website/src/types.ts` | Reformat the result-related interfaces to match the generated output exactly (minor whitespace normalization only -- the actual field names and types are already correct). Keep `GroupStats` at the bottom, outside the generated section, delimited by a comment marker. |
| `package.json` | Add `"website:check-types": "python scripts/check_types_sync.py"` script. |

## Validation strategy

The `validate_result` function does structural validation only:
- Checks all required top-level keys exist
- Checks `steps` is a list and each step has the required keys
- Checks `failure` is either `null` or has the required keys
- Checks enum values for `direction` (`"ascent"` | `"descent"`)
- Does NOT do deep type checking of every field (overkill for this harness)

This keeps the validator under 60 lines with no dependencies.

## TypeScript generation strategy

The `generate_types_ts()` function emits TypeScript interface text from the TypedDict definitions. It handles the small type mapping: `int -> number`, `str -> string`, `bool -> boolean`, `None -> null`, `list[X] -> X[]`. The generated block is wrapped in comment markers:

```typescript
// --- BEGIN GENERATED TYPES (do not edit manually) ---
...interfaces...
// --- END GENERATED TYPES ---
```

The check script reads `types.ts`, extracts the content between these markers, and compares it to the generated output. `GroupStats` lives below the end marker and is untouched.

## Tests

No new test files. Validation is tested implicitly:
- `run_experiment.py` will crash on write if the schema drifts (immediate feedback during experiment runs)
- `check_types_sync.py` is its own test -- run it to verify sync
- Existing `website:test` (vitest) continues to cover the TypeScript side

Can add a quick smoke test later if desired, but the validation function is simple enough that bugs would surface immediately in use.

## Out of Scope

- Migrating to JSON Schema or a shared schema language (overkill for this project)
- Adding `jsonschema` or `pydantic` as dependencies
- Generating Python code from TypeScript (Python is the source of truth, not the other way around)
- Validating the content of `results.json` (the exported website file) -- it's derived from validated individual results
- Adding GitHub Actions CI (no CI config exists in this repo)
