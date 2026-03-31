# Improvement Opportunities — Skillception

**Date:** 2026-03-30
**Scope:** Full codebase (`scripts/`, `website/src/`, `agents/`, `.context/`)
**Automated tool findings:** TypeScript: 0 errors. ESLint: 0 warnings. npm audit: 0 vulnerabilities. Vitest: 33/33 tests passing.

---

## Critical

*No critical issues found.* The codebase is clean on security, data integrity, and error handling in all the areas that matter for an experiment harness.

---

## Important

### 1. Undefined CSS custom property `--color-body` used in App.tsx
**Location:** `website/src/App.tsx:110`, `website/src/index.css`
**Category:** Error Handling / Dead Code
**Description:** `App.tsx` renders `color: "var(--color-body)"` in the no-data error state. That CSS variable is never defined in `index.css` (which only defines `--color-ink`, `--color-footnote`, `--color-caption`, etc.). In supported browsers this silently falls back to `inherit`, so the text renders but the intent (presumably a specific muted colour) is not achieved. This is the only place the property appears, so it's either a stale rename or a copy-paste slip.
**Suggestion:** Replace `var(--color-body)` with `var(--color-footnote)` (or whichever variable carries the muted body-text semantic) and verify visually.

---

### 2. Duplicate `import type … from "./types"` in App.tsx splits a single logical import
**Location:** `website/src/App.tsx:2` and `website/src/App.tsx:10`
**Category:** Convention Compliance / Code Structure
**Description:** Two separate `import type` statements both pull from `./types` — line 2 imports `RunResult, GroupStats` and line 10 imports `RoundTokenStats`. This is a minor convention violation but shows up as two statements when one would suffice, and `noUnusedLocals` is enabled, so any future cleanup passes may leave one broken.
**Suggestion:** Merge into a single `import type { RunResult, GroupStats, RoundTokenStats } from "./types"` statement.

---

### 3. `logger.setLevel(DEBUG)` but no console/stream handler is ever attached
**Location:** `scripts/run_experiment.py:44-45`
**Category:** Error Handling / Convention Gap
**Description:** The module-level logger is set to `DEBUG` severity. `setup_run_logger` attaches a file handler at `WARNING`. No `StreamHandler` is ever added, so `logger.debug(...)` and `logger.info(...)` calls silently disappear. The harness uses `print()` for all real-time console feedback, so this is intentional — but the `setLevel(DEBUG)` line is misleading (it implies debug output should be visible somewhere). If future debugging requires log-level output, this setup will still suppress it.
**Suggestion:** Either add a comment explaining the "print for console, file handler for warnings" convention, or lower the module logger to `WARNING` to reflect actual behaviour, and document that `print()` is the intentional live-feedback channel.

---

## Moderate

### 4. `load_results` duplicated between `analyze_results.py` and `export_results.py`
**Location:** `scripts/analyze_results.py:23-38`, `scripts/export_results.py:22-45`
**Category:** Duplication
**Description:** Both scripts contain nearly identical `glob("*/result.json")` + JSON parse + `validate_result` loops. They differ only in that `export_results.py` also strips `source_path`/`output_path` from steps. This means any future change to loading logic (e.g., adding a new warning condition) must be applied in two places.
**Suggestion:** Extract a shared `load_results(runs_dir)` function into `result_schema.py` (or a new `scripts/loader.py`). `export_results.py` can call it and then apply the path-stripping post-processing step.

---

### 5. `_run_step` accesses `exec_result["output_content"]` without checking for key existence
**Location:** `scripts/run_experiment.py:424`
**Category:** Error Handling
**Description:** `_run_step` calls `exec_result["output_content"]` directly after the `if not exec_result["success"]` early return. The `output_content` key is only added by the `executor` closure in `run_single_experiment` — it is not guaranteed by the `run_executor` return type contract (`dict` with keys `success`, `output_path`, `token_usage`, `error`). If `_run_step` were ever called with a raw `run_executor_with_retries` result directly (e.g., in a future test or refactor), this would raise `KeyError`. The `executor` signature documented in `run_rounds`'s docstring says `output_content` must be present, but this is unenforced.
**Suggestion:** Either: (a) have `run_executor_with_retries` always return the `output_content` key (set to `None` on failure), or (b) use `.get("output_content")` with a `None` guard and an explicit assertion/error, or (c) add this key to a typed interface so the contract is machine-checked.

---

### 6. `run_id` collision risk: only 8 hex characters (32-bit entropy)
**Location:** `scripts/run_experiment.py:663`
**Category:** Hardcoded Values / Performance
**Description:** `run_id = str(uuid.uuid4())[:8]` truncates a UUID to 8 hex chars, giving 2^32 (~4 billion) possible IDs. For a small experiment this is fine, but if a batch of 100+ runs is ever launched, the birthday-paradox collision probability becomes non-trivial (~1 in 40 million per pair). Collisions would silently overwrite a prior run's `result.json`. The `run_id` is also used as the directory name and as the display key in the website, so a collision is destructive.
**Suggestion:** Use the full UUID (or at least 12 characters, 48-bit, for comfortable safety). The website already slices to 8 chars for display (`run.run_id.slice(0, 8)`), so increasing the stored length is backward-compatible.

---

### 7. `Math.max(...largeArray)` spread pattern — potential stack overflow on large datasets
**Location:** `website/src/App.tsx:134`, `website/src/components/Abstract.tsx:20`, `website/src/components/RunAccordion.tsx:11`, `website/src/components/BarChart.tsx:14`
**Category:** Performance
**Description:** Spreading an array into `Math.max()` works via call stack arguments. For typical experiment sizes (tens to low hundreds of runs) this is harmless. If the dataset ever grows to thousands of runs, V8's maximum argument count (~65k) would cause a RangeError. `Array.prototype.reduce` is the idiomatic safe alternative.
**Suggestion:** Replace `Math.max(...arr, 0)` with `arr.reduce((a, b) => Math.max(a, b), 0)` in the four locations. Low priority given current scale, but easy to fix.

---

### 8. `source_path` field present in `Step` TypedDict but stripped before export — types.ts is unaware
**Location:** `scripts/result_schema.py:26-37`, `scripts/export_results.py:40-41`, `website/src/types.ts:14-25`
**Category:** Type Safety / Convention Gap
**Description:** `export_results.py` strips `source_path` and `output_path` from each step before writing `results.json`. The Python `Step` TypedDict includes neither of these (they were schema extras), and `types.ts` doesn't include them either. However, `run_experiment.py` does write them into the raw `result.json` (line 412). This means raw `result.json` files have fields not covered by the schema validator. The discrepancy is harmless today but creates a documentation gap: someone reading `result_schema.py` won't know those fields exist in raw data.
**Suggestion:** Add `source_path` and `output_path` as `NotRequired[str]` to the Python `Step` TypedDict, annotate them as "present in raw data, stripped on export", and update the `validate_result` function to tolerate (but not require) them. This makes the schema the single source of truth for what raw files contain.

---

## Nice-to-Have

### 9. `App.tsx` exceeds comfortable single-file size (482 lines) and mixes concerns
**Location:** `website/src/App.tsx`
**Category:** Decomposition
**Description:** `App.tsx` contains data-fetching logic, two helper functions (`buildRoundBars`, `buildTokenRows`), a display formatter (`failPct`), a label builder (`variantLabel`), and the full render tree (four sections). At 482 lines it is within tolerable range but the data-preparation helpers are testable pure functions that belong in `analyze.ts`, and the round/token bar section rendering could be a component.
**Suggestion:** Move `buildRoundBars`, `buildTokenRows`, `failPct`, and `variantLabel` to `analyze.ts` (they operate purely on data from that module). Consider extracting the "token consumption section" into a `TokenSection` component. This would bring `App.tsx` under ~300 lines.

---

### 10. `computeTokensByRound` uses index-parallel arrays (`TOKEN_FIELDS`/`sums`) instead of object accumulation
**Location:** `website/src/lib/analyze.ts:118-173`
**Category:** Code Structure / Decomposition
**Description:** The function maintains parallel `number[]` arrays indexed by position in `TOKEN_FIELDS` for accumulation. This is correct but the relationship between index positions and field names is implicit — a bug where someone reorders `TOKEN_FIELDS` would produce silently wrong results. The pattern is also harder to read than accumulating directly into an object.
**Suggestion:** Replace `{ sums: number[]; count: number }` with `{ sums: Partial<TokenUsage>; count: number }` and accumulate by field name directly. Minor readability improvement.

---

### 11. Stale `logger.setLevel(logging.DEBUG)` is a noisy signal in the module
**Location:** `scripts/run_experiment.py:45`
**Category:** Stale TODOs / Convention Gap
**Description:** This was covered under item 3 above — noting separately that it also reads as if DEBUG output should be visible, which may confuse future contributors. The comment context is the only indication of intent.

*(Cross-listed with item 3 — no separate action needed.)*

---

### 12. No `engines` field in `website/package.json` — Node version for Render deploy is undocumented
**Location:** `website/package.json` (not directly read, inferred from `deploy-render.md`)
**Category:** Convention Gap / Dependency Health
**Description:** `.context/deploy-render.md` notes "the site works with Node 18+" and suggests adding a `.nvmrc`. Neither `website/package.json` nor a `website/.nvmrc` specifies a Node version. This means Render uses its default, which can change on platform updates. There's no local enforcement either.
**Suggestion:** Add `"engines": { "node": ">=20" }` to `website/package.json` and optionally a `website/.nvmrc` containing `20` for local tooling.

---

### 13. `analyze_results.py` has no `__init__` guard but imports `scripts.*` conditionally
**Location:** `scripts/analyze_results.py:1-12` and `scripts/run_experiment.py:28-31`
**Category:** Convention Compliance
**Description:** Both `analyze_results.py` and `run_experiment.py` use a try/except import pattern to handle being run as `python scripts/foo.py` vs as a module. This works but it's a code smell — each script independently reinvents the path-handling. `check_types_sync.py` uses `sys.path.insert(0, ...)` instead, a third approach.
**Suggestion:** Standardize on one pattern across all scripts — `sys.path.insert(0, ...)` at the top of each standalone script is the most explicit and doesn't mask genuine ImportErrors. Document this pattern in `CLAUDE.md` under a "Script conventions" section.

---

### 14. `pickFailureQuotes` builds a long ternary description inline — hard to test edge cases
**Location:** `website/src/lib/analyze.ts:232`
**Category:** Decomposition
**Description:** The `description` string in `pickFailureQuotes` has a nested ternary inside a template literal that handles four cases (null level + string error, null level + non-string error, numeric level). This logic is already tested indirectly by the test suite but is hard to test the `typeof r.failure!.error === 'string' ? r.failure!.error + ' error' : 'error'` branch in isolation.
**Suggestion:** Extract a `formatDetectedLevel(failure: Failure): string` helper function with dedicated test cases for each branch.

---

## Convention Gap Recommendations

Patterns observed in the codebase but not documented — consider adding to `CLAUDE.md` or `.context/`:

1. **Print-for-console, logger-for-disk convention:** The Python harness uses `print()` for real-time run feedback and `logger.warning()` exclusively for the file-based error log. This is a deliberate split but is not written down anywhere. New contributors may add `logger.info()` calls expecting them to appear on stdout.

2. **`run_id` is 8 hex chars for display, full string in storage:** The harness generates 8-char run IDs that are used directly as directory names and primary keys. The website slices to 8 chars for display. These are currently equal but the convention that "run IDs are short enough to be human-readable" is implicit.

3. **The `source_path`/`output_path` strip-on-export contract:** Raw `result.json` files contain filesystem paths that are stripped by `export_results.py` before publishing. This is documented in a comment in `export_results.py` but not in `result_schema.py` where you'd look for schema docs.

4. **Test factory pattern in `analyze.test.ts`:** The `makeRun`, `makeStep`, `makeFailure`, `makeUsage` factory functions are a clean testing convention worth noting explicitly so future tests follow the same pattern rather than constructing objects inline.

---

## Metrics Summary

| Lens | Critical | Important | Moderate | Nice-to-have |
|------|----------|-----------|----------|--------------|
| Security | 0 | 0 | 0 | 0 |
| Performance | 0 | 0 | 1 | 0 |
| Test Coverage | 0 | 0 | 0 | 1 |
| Convention Compliance | 0 | 1 | 0 | 1 |
| Convention Gaps | 0 | 0 | 1 | 1 |
| Duplication | 0 | 0 | 1 | 0 |
| Decomposition | 0 | 0 | 0 | 2 |
| Dead Code | 0 | 1 | 0 | 0 |
| Type Safety | 0 | 0 | 1 | 0 |
| Error Handling | 0 | 1 | 1 | 0 |
| Dependency Health | 0 | 0 | 0 | 1 |
| Hardcoded Values | 0 | 0 | 1 | 0 |
| Stale TODOs | 0 | 0 | 0 | 0 |
| Architecture | 0 | 0 | 0 | 0 |
| **Total** | **0** | **3** | **6** | **6** |
