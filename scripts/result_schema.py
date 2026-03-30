"""Canonical schema definitions and shared utilities for experiment results.

Defines the TypedDicts that describe the JSON structure of run results,
and provides a shared loader used by both analyze_results.py and
export_results.py.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import TypedDict

from typing_extensions import NotRequired


class TokenUsage(TypedDict):
    inputTokens: int
    outputTokens: int
    cacheReadInputTokens: int
    cacheCreationInputTokens: int


class JudgeResult(TypedDict):
    detected_level: int
    reasoning: str


class Step(TypedDict):
    step_index: int
    round: int
    direction: str  # "ascent" | "descent"
    source_level: int
    target_level: int
    passed: bool
    expected_level: int
    executor_usage: TokenUsage | None
    judge_usage: TokenUsage | None
    judge_result: JudgeResult
    # Present in raw data, stripped on export
    source_path: NotRequired[str]
    output_path: NotRequired[str]


class Failure(TypedDict):
    round: int
    step_index: int
    expected_level: int
    detected_level: int
    reasoning: str


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


def load_results(runs_dir: Path) -> list[dict]:
    """Load all result.json files from run subdirectories.

    Shared by analyze_results.py and export_results.py to avoid
    duplicating the glob-and-parse logic.
    """
    results = []
    for f in sorted(runs_dir.glob("*/result.json")):
        try:
            results.append(json.loads(f.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError) as e:
            print(f"  Warning: skipping {f.parent.name}: {e}", file=sys.stderr)
    return results
