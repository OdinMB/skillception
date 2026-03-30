# Add Model Parameter to Experiment

- **Date**: 2026-03-29
- **Status**: draft
- **Type**: feature

## Problem
The experiment harness hardcodes whichever model the user's `claude` CLI defaults to. To compare Opus vs Sonnet vs Haiku recursion depth, we need a `--model` flag and model metadata in results.

## Approach
Thread a `--model` argument through the CLI → `call_claude` → result JSON. The `claude` CLI already accepts `--model <model>`. Analysis script groups stats by model when multiple models are present.

## Changes

| File | Change |
|------|--------|
| `scripts/run_experiment.py` | Add `--model` argparse arg (default: `opus`). Pass `--model` to the `claude` subprocess in `call_claude`. Store `model` in the result dict. Thread model through `call_claude` → `run_executor` → `run_judge` → `run_single_experiment` → `main`. |
| `scripts/analyze_results.py` | Read `model` from results. When results contain multiple models, group all stats by model. Show model in header. |

## Tests
Manual: run `python scripts/run_experiment.py --model sonnet --max-rounds 1 --runs 1` and verify the result JSON contains `"model": "sonnet"`. Run `analyze_results.py` and confirm model appears in output.

## Out of Scope
- Parallel runs across models (user can do separate invocations)
- Model-specific tuning of max-turns or timeout
- Validating that the model string is a real Claude model
