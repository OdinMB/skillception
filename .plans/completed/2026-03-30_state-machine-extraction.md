# Extract Experiment State Machine

- **Date**: 2026-03-30
- **Status**: implemented
- **Type**: refactor
- **Depends on**: Plan 04 (call_claude injectable subprocess pattern)

## Problem

`run_single_experiment()` (lines 298-514) is a 217-line monolith mixing filesystem I/O, subprocess orchestration, the ascent/descent state machine, pass/fail validation, and result serialization. The round progression logic is untestable without real `claude` subprocess calls.

## Approach

Extract the round progression loop into a pure function `run_rounds()` that takes executor and judge callables as parameters. The function owns only the state machine logic (ascent, descent, pass/fail, when to stop) and returns the completed result dict. `run_single_experiment()` becomes a thin orchestrator that constructs the callables and handles filesystem setup.

**Alternative considered: a `ExperimentStateMachine` class.** Rejected because the state machine is linear (no branching, no pause/resume) and all state is consumed in a single call. A class would add ceremony (init, methods, properties) for no benefit over a function with clear inputs and outputs.

**Alternative considered: generator/coroutine yielding steps.** More elegant for pause/resume but adds complexity for a loop that always runs to completion. YAGNI.

## Design

### Callable protocols

The extracted function takes two callables matching these signatures (assuming plan 04's injection pattern is in place):

```python
# Executor: given source content and target level, returns exec_result dict
# Signature: (source_content: str, target_level: int) -> dict
#   Returns: {"success": bool, "output_path": str, "output_content": str | None,
#             "token_usage": dict | None, "error": str | None}

# Judge: given skill content, returns judge_result dict
# Signature: (skill_content: str) -> dict
#   Returns: {"detected_level": int, "reasoning": str,
#             "token_usage": dict | None, "error": str | None}
```

Key change: the executor callable must also return `output_content` (the generated file's text) so the state machine doesn't need to read files. The orchestrator in `run_single_experiment()` wraps `run_executor()` to add the file-reading step.

### The extracted function

```python
def run_rounds(
    bootstrap_content: str,
    bootstrap_path: str,
    max_rounds: int,
    executor: Callable[[str, int], dict],
    judge: Callable[[str], dict],
) -> dict:
```

Returns the same result dict shape currently built inside `run_single_experiment()` (with `steps`, `failure`, `max_round`, `total_steps`, `total_usage`). Does NOT include `run_id`, `model`, `judge_model`, or `timestamp` -- the orchestrator adds those.

Print statements for progress stay in `run_rounds()` for now (they're part of the experiment's UX, not a testing concern -- tests can capture stdout or ignore it).

## Changes

| File | Change |
|------|--------|
| `scripts/run_experiment.py` | Add `run_rounds()` function (~100 lines) extracted from `run_single_experiment()` lines 324-514. The function takes `bootstrap_content`, `bootstrap_path`, `max_rounds`, `executor` callable, and `judge` callable. |
| `scripts/run_experiment.py` | Slim `run_single_experiment()` to ~30 lines: build the result metadata (`run_id`, `model`, `timestamp`), construct executor/judge lambdas that wrap `run_executor()` + file reading and `run_judge_with_retries()`, call `run_rounds()`, merge results. |
| `tests/test_state_machine.py` | New file. Tests `run_rounds()` with fake executor/judge callables. Cases: (1) perfect run completes all rounds, (2) executor failure on ascent stops immediately, (3) judge mismatch on ascent stops, (4) judge error stops, (5) descent failure stops, (6) descent mismatch stops, (7) single round completes and produces correct step records. |

### Executor wrapper detail

In the slimmed `run_single_experiment()`, the executor lambda wraps `run_executor()` like:

```python
def executor(source_content: str, target_level: int) -> dict:
    nonlocal step_index
    step_dir = skills_dir / f"step-{step_index:02d}"
    result = run_executor(source_content, target_level, step_dir, model=model)
    if result["success"]:
        result["output_content"] = Path(result["output_path"]).read_text(encoding="utf-8")
    else:
        result["output_content"] = None
    return result
```

The `step_index` tracking moves into `run_rounds()` since it's part of the state machine. The step_dir construction stays in the lambda since it's filesystem I/O. Actually, `run_rounds()` owns `step_index` internally and passes it to the executor via an extended signature or by having the orchestrator use a closure that `run_rounds` feeds the index to. Simpler: the executor callable takes a third `step_index` parameter:

```python
executor: Callable[[str, int, int], dict]  # (source_content, target_level, step_index)
```

This lets the orchestrator use step_index for directory naming without the state machine knowing about filesystems.

## Tests

No existing Python test infrastructure. The new test file will use `pytest` directly (standard library `unittest` would also work, but pytest is more conventional for Python projects).

Test cases for `run_rounds()`:

1. **Full success** -- fake executor always succeeds, fake judge always returns the expected level. Verify `max_round == max_rounds`, `failure is None`, correct step count.
2. **Ascent executor failure** -- executor returns `success: False` on first call. Verify `failure` is set, `total_steps == 1`.
3. **Ascent judge mismatch** -- judge returns wrong level on ascent. Verify failure records expected vs detected.
4. **Ascent judge error** -- judge returns an error. Verify failure with `detected_level: -1`.
5. **Descent failure** -- ascent passes, descent executor fails. Verify round and step_index in failure.
6. **Descent mismatch** -- ascent passes, descent judge returns wrong level.
7. **Step record structure** -- verify each step has all expected keys (`step_index`, `round`, `direction`, `source_level`, `target_level`, `passed`, `executor_usage`, `judge_usage`, etc.).

## Out of Scope

- Refactoring `run_executor()` or `run_judge()` internals (that's plan 04's territory).
- Removing print statements or adding a proper logging framework.
- Adding `pyproject.toml` or test configuration (can be a follow-up).
- Making `run_rounds()` async or adding pause/resume capability.
