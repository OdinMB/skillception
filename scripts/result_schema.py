"""Result schema contract for Skillception experiment data.

Defines TypedDicts matching the canonical result.json shape and the
website's TypeScript types. Provides validation and TS codegen so
Python and TypeScript never quietly drift apart.

Usage:
    from result_schema import validate_result, RunResult
"""

from typing import NotRequired, TypedDict


class JudgeResult(TypedDict):
    detected_level: int | None
    reasoning: str


class TokenUsage(TypedDict):
    inputTokens: int
    outputTokens: int
    cacheReadInputTokens: int
    cacheCreationInputTokens: int


class Step(TypedDict):
    step_index: int
    round: int
    direction: str  # 'ascent' | 'descent'
    source_level: int
    target_level: int
    passed: bool
    expected_level: int
    executor_usage: TokenUsage | None
    judge_usage: TokenUsage | None
    judge_result: JudgeResult


class Failure(TypedDict):
    round: int
    step_index: int
    expected_level: int
    detected_level: int | None
    reasoning: str
    error: NotRequired[bool | str]  # False | "call" | "parse" (absent in legacy data)


class RunResult(TypedDict):
    run_id: str
    model: str
    judge_model: str
    timestamp: str
    max_round: int
    total_steps: int
    total_usage: TokenUsage | None
    steps: list[Step]
    failure: Failure | None


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

_TOKEN_USAGE_KEYS = {"inputTokens", "outputTokens",
                     "cacheReadInputTokens", "cacheCreationInputTokens"}

_JUDGE_RESULT_KEYS = {"detected_level", "reasoning"}

_STEP_KEYS = {"step_index", "round", "direction", "source_level",
              "target_level", "passed", "expected_level",
              "executor_usage", "judge_usage", "judge_result"}

_FAILURE_KEYS = {"round", "step_index", "expected_level",
                 "detected_level", "reasoning"}

_RUN_RESULT_KEYS = {"run_id", "model", "judge_model", "timestamp",
                    "max_round", "total_steps", "total_usage",
                    "steps", "failure"}


def _check_keys(obj: dict, required: set[str], label: str) -> list[str]:
    """Return a list of error strings for missing keys."""
    missing = required - set(obj.keys())
    if missing:
        return [f"{label}: missing keys {sorted(missing)}"]
    return []


def _validate_token_usage(obj: object, label: str) -> list[str]:
    """Validate a TokenUsage dict (or None)."""
    if obj is None:
        return []
    if not isinstance(obj, dict):
        return [f"{label}: expected dict or null, got {type(obj).__name__}"]
    errors = _check_keys(obj, _TOKEN_USAGE_KEYS, label)
    for key in _TOKEN_USAGE_KEYS:
        if key in obj and not isinstance(obj[key], int):
            errors.append(f"{label}.{key}: expected int, got {type(obj[key]).__name__}")
    return errors


def _validate_judge_result(obj: object, label: str) -> list[str]:
    if not isinstance(obj, dict):
        return [f"{label}: expected dict, got {type(obj).__name__}"]
    errors = _check_keys(obj, _JUDGE_RESULT_KEYS, label)
    if "detected_level" in obj and obj["detected_level"] is not None and not isinstance(obj["detected_level"], int):
        errors.append(f"{label}.detected_level: expected int or null")
    if "reasoning" in obj and not isinstance(obj["reasoning"], str):
        errors.append(f"{label}.reasoning: expected str")
    return errors


def _validate_step(obj: object, idx: int) -> list[str]:
    label = f"steps[{idx}]"
    if not isinstance(obj, dict):
        return [f"{label}: expected dict"]
    errors = _check_keys(obj, _STEP_KEYS, label)
    if "direction" in obj and obj["direction"] not in ("ascent", "descent"):
        errors.append(f"{label}.direction: expected 'ascent'|'descent', got '{obj['direction']}'")
    if "passed" in obj and not isinstance(obj["passed"], bool):
        errors.append(f"{label}.passed: expected bool")
    errors.extend(_validate_token_usage(obj.get("executor_usage"), f"{label}.executor_usage"))
    errors.extend(_validate_token_usage(obj.get("judge_usage"), f"{label}.judge_usage"))
    if "judge_result" in obj and obj["judge_result"] is not None:
        errors.extend(_validate_judge_result(obj["judge_result"], f"{label}.judge_result"))
    return errors


def _validate_failure(obj: object) -> list[str]:
    if obj is None:
        return []
    if not isinstance(obj, dict):
        return ["failure: expected dict or null"]
    errors = _check_keys(obj, _FAILURE_KEYS, "failure")
    if "error" in obj:
        val = obj["error"]
        if val is not False and val not in ("call", "parse"):
            errors.append(
                f"failure.error: expected false|'call'|'parse', got {val!r}")
    return errors


def validate_result(data: dict) -> list[str]:
    """Validate a result dict against the RunResult schema.

    Returns a list of error strings. Empty list means valid.
    """
    if not isinstance(data, dict):
        return ["root: expected dict"]

    errors = _check_keys(data, _RUN_RESULT_KEYS, "root")

    # Validate top-level types
    for key in ("run_id", "model", "judge_model", "timestamp"):
        if key in data and not isinstance(data[key], str):
            errors.append(f"root.{key}: expected str, got {type(data[key]).__name__}")
    for key in ("max_round", "total_steps"):
        if key in data and not isinstance(data[key], int):
            errors.append(f"root.{key}: expected int, got {type(data[key]).__name__}")

    errors.extend(_validate_token_usage(data.get("total_usage"), "root.total_usage"))

    # Validate steps
    steps = data.get("steps")
    if steps is not None:
        if not isinstance(steps, list):
            errors.append("root.steps: expected list")
        else:
            for i, step in enumerate(steps):
                errors.extend(_validate_step(step, i))

    # Validate failure
    errors.extend(_validate_failure(data.get("failure")))

    return errors


# ---------------------------------------------------------------------------
# TypeScript codegen
# ---------------------------------------------------------------------------

def generate_types_ts() -> str:
    """Generate the TypeScript interfaces that belong inside the marker block."""
    return """\
export interface JudgeResult {
  detected_level: number | null
  reasoning: string
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

export interface Step {
  step_index: number
  round: number
  direction: 'ascent' | 'descent'
  source_level: number
  target_level: number
  passed: boolean
  expected_level: number
  executor_usage: TokenUsage | null
  judge_usage: TokenUsage | null
  judge_result: JudgeResult
}

export interface Failure {
  round: number
  step_index: number
  expected_level: number
  detected_level: number | null
  reasoning: string
  error?: false | 'call' | 'parse'
}

export interface RunResult {
  run_id: string
  model: string
  judge_model: string
  timestamp: string
  max_round: number
  total_steps: number
  total_usage: TokenUsage | null
  steps: Step[]
  failure: Failure | null
}"""
