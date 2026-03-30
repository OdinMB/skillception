# Refactor call_claude() to Separate Concerns and Enable Testing

- **Date**: 2026-03-30
- **Status**: implemented
- **Type**: refactor

## Problem

`call_claude()` bundles temp file management, env setup, subprocess invocation, and JSON parsing into one untestable function. `run_executor` and `run_judge` can't be tested without spawning real Claude processes because the subprocess call isn't injectable.

## Approach

Add an optional `runner` parameter to `call_claude()` — a callable with the same signature as `subprocess.run` — defaulting to `subprocess.run`. This lets tests inject a fake runner that returns canned `CompletedProcess` objects. Also introduce a small `ClaudeResult` TypedDict (or dataclass) to replace the ad-hoc dict with explicit success/error typing.

**Alternatives considered:**
- *Module-level `_subprocess_runner` variable*: slightly more magical, harder to scope to individual tests. The parameter approach is more explicit and Pythonic for a small harness.
- *Protocol/ABC for a "Claude client"*: over-abstraction for a script with two callers. Rejected per task instructions ("don't over-abstract").
- *Refactoring into a class*: unnecessary state; the function is stateless by design.

## Changes

| File | Change |
|------|--------|
| `scripts/run_experiment.py` | 1. Add `ClaudeResponse` TypedDict with `result: str`, `token_usage: dict | None`, `error: str | None` fields. Success has `error=None`; failure has `error` set. This replaces the current ambiguous dict where callers check `"error" in response`. |
| `scripts/run_experiment.py` | 2. Add `runner` parameter to `call_claude()`: `runner: Callable[..., subprocess.CompletedProcess] | None = None`, defaulting to `subprocess.run` inside the function body. Pass `runner` instead of `subprocess.run` at the invocation site (line 95). |
| `scripts/run_experiment.py` | 3. Update `call_claude()` return to always use `ClaudeResponse` — set `error=None` on success paths, set `error=<message>` on failure paths. Remove the pattern of omitting the `error` key on success. |
| `scripts/run_experiment.py` | 4. Update `run_executor` and `run_judge` to accept an optional `runner` parameter and forward it to `call_claude()`. This keeps the injection path open for tests without changing default behavior. |
| `scripts/run_experiment.py` | 5. Update callers in `run_executor` (line 206) and `run_judge` (line 241) to check `response["error"] is not None` instead of `"error" in response`. |
| `scripts/run_experiment.py` | 6. Update `run_judge_with_retries` to accept and forward the optional `runner` parameter. |

## Detailed Design

### ClaudeResponse TypedDict

```python
from typing import TypedDict

class ClaudeResponse(TypedDict):
    result: str
    token_usage: dict | None
    error: str | None  # None = success, str = failure description
```

### call_claude() signature change

```python
def call_claude(prompt: str, allowed_tools: str | None = None,
                timeout: int = 300, model: str | None = None,
                tmp_dir: Path | None = None,
                runner: Callable[..., subprocess.CompletedProcess] | None = None) -> ClaudeResponse:
```

Inside the function, `run = runner or subprocess.run` replaces the direct `subprocess.run` call.

### Caller updates

`run_executor` and `run_judge` each gain `runner=None` as their last parameter and pass it through:

```python
def run_executor(source_content, target_level, output_dir, model=None, runner=None):
    ...
    response = call_claude(prompt, allowed_tools="Read,Write", model=model,
                           tmp_dir=output_dir, runner=runner)
```

The check `if "error" in response:` becomes `if response["error"] is not None:`.

## Tests

No test infrastructure exists in this repo yet. This refactor *enables* testing but does not add tests — that's a separate task. A future test file (`scripts/test_run_experiment.py` or `tests/test_harness.py`) would:

1. Define a fake runner returning `CompletedProcess(args=[], returncode=0, stdout='{"result":"...","modelUsage":{}}', stderr='')`
2. Call `call_claude(..., runner=fake_runner)` and assert the `ClaudeResponse` fields
3. Call `run_executor(..., runner=fake_runner)` with a temp dir and assert file-writing behavior
4. Call `run_judge(..., runner=fake_runner)` and assert JSON extraction

## Out of Scope

- Adding actual test files or test infrastructure (pytest, etc.) — this plan only makes testing *possible*
- Refactoring `run_single_experiment` to accept runners (it calls `run_executor`/`run_judge` which now accept them; that's sufficient)
- Extracting `call_claude` into a separate module — one file is fine for this harness size
- Changing the temp-file strategy or env-stripping logic — those stay as-is
