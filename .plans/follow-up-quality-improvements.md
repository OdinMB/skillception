# Follow-Up: Quality & Architectural Improvements

## Controversial Decisions

- **Item 10 (variantLabel signature)**: Changed from `variantLabel(model, variant)` taking object params to `variantLabel(modelName, modelLabel, judgeName, judgeLabel)` taking primitive params. This makes it a pure function with no dependency on component-specific interfaces, which is better for testing, but changes the ergonomics at call sites.

## Skipped Items

- **Item 2 (duplicate import type)**: The current App.tsx has only one `import type` from `./types` (line 2). No duplicate exists on line 10 -- that line imports from `./components/Abstract`. Possibly already fixed or referencing stale code.
- **Item 3 (logger.setLevel(DEBUG))**: The current `run_experiment.py` has no `logging` module import and no `logger.setLevel()` call. It uses `print()` for console output. The referenced lines 44-45 contain `make_env()` and `level_name()`. Possibly already fixed or referencing a different version.
- **Item 5 (_run_step output_content key check)**: No `_run_step` function or `output_content` key access exists in the current code. The executor result uses `output_path` and files are read separately. Possibly already refactored.
- **Item 11 (computeTokensByRound index-parallel arrays)**: The function `computeTokensByRound` does not exist in the current codebase. Possibly planned but not yet implemented.

## User Input Needed

## Files to Delete

- `test_schema_import.py` (temporary verification script)

## Implementation Issues

## Borderline Insights

- The `analyze_results.py` `main()` function calls `analyze(clean_results)` but the function is defined as `analyze()` -- this works but the naming is confusing since there's also `analyze_group()`. Consider renaming for clarity.

## Suggested Follow-Up Work

- Consider adding `typing_extensions` to a requirements.txt or pyproject.toml since `result_schema.py` now depends on it.
- The `check_types_sync.py` script does structural field-name comparison only. It does not verify type compatibility (e.g., `int` vs `string`). A more robust version could parse type annotations.
