# Harden Judge JSON Extraction Logic

- **Date**: 2026-03-30
- **Status**: implemented
- **Type**: bugfix

## Problem

`extract_json()` in `scripts/run_experiment.py` uses a non-greedy regex `r'\{.*?\}'` that grabs the *smallest* `{...}` block. If the judge's `reasoning` field contains braces (e.g., `"reasoning": "The skill defines a {meta} pattern"`), the regex matches that inner fragment instead of the full JSON object. It also doesn't strip markdown code fences, which Claude commonly wraps JSON in.

## Approach

Replace the regex strategy with a simple brace-counting scanner that finds balanced `{...}` blocks, and add a pre-processing step that strips markdown code fences. Add a test file with pytest-style unit tests covering the edge cases. No new abstractions -- just improve the one function and test it.

**Alternatives considered:**

- *Greedy regex `\{.*\}`* -- would overshoot if there are multiple JSON objects in the text. Rejected.
- *Python `json.JSONDecoder.raw_decode()`* -- could work but still needs brace-finding to locate the start position, so it doesn't simplify the code meaningfully. However, we can use it as a secondary strategy: attempt `raw_decode` at each `{` position. This is actually simpler than manual brace counting because `json` handles all escaping/nesting correctly. **Chosen approach**: iterate over `{` positions and try `raw_decode` at each. This is fewer lines, inherently correct for nested braces, and avoids reimplementing JSON structure awareness.

The extraction pipeline will be:

1. Try `json.loads(text)` on the full stripped text (existing fast path).
2. Strip markdown code fences (```` ```json ... ``` ```` or ```` ``` ... ``` ````), try `json.loads` on each fenced block.
3. Use `json.JSONDecoder().raw_decode()` scanning from each `{` in the text.
4. Return the first object containing `"detected_level"`, or `None`.

## Changes

| File | Change |
|------|--------|
| `scripts/run_experiment.py` (lines 137-155) | Rewrite `extract_json()` with fence-stripping and `raw_decode` scanning. ~25 lines replacing ~18 lines. |
| `tests/test_extract_json.py` (new) | Unit tests: plain JSON, fenced JSON, nested braces in values, multiple objects, prose-only (no JSON), empty string, fenced block with wrong key. |

## Tests

Create `tests/test_extract_json.py` using plain pytest (no project test infra exists for Python yet). Tests will import `extract_json` directly from `scripts.run_experiment` (or use `importlib`/`sys.path` manipulation since `scripts/` isn't a package).

Test cases:
1. **Plain JSON** -- `{"detected_level": 3, "reasoning": "..."}` parses correctly.
2. **Prose wrapper** -- `"Here is my analysis:\n{...}\nHope that helps!"` extracts the JSON.
3. **Markdown fenced** -- `` ```json\n{...}\n``` `` extracts correctly.
4. **Nested braces in reasoning** -- `{"detected_level": 2, "reasoning": "uses {meta} patterns"}` extracts full object, not inner `{meta}`.
5. **Multiple objects** -- text containing a distractor `{}` before the real object picks the one with `detected_level`.
6. **No JSON at all** -- returns `None`.
7. **Empty string** -- returns `None`.

## Out of Scope

- Adding `pyproject.toml` or full Python project packaging -- tests can run with `python -m pytest tests/` from the repo root.
- Changing the judge prompt to produce cleaner output -- that's a separate concern.
- Modifying `call_claude()` or any other function.
