"""Snapshot tests for analyze_results.py output formatting."""

import json
import os
import sys
from io import StringIO
from pathlib import Path

import pytest

from scripts.analyze_results import analyze_group, load_results

SNAPSHOTS_DIR = Path(__file__).parent / "snapshots"
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _make_result(run_id, max_round, failure=None, steps=None, model="opus",
                 judge_model="opus"):
    """Build a minimal valid result dict."""
    if steps is None:
        steps = []
        step_idx = 0
        for rnd in range(1, max_round + 1):
            target = rnd + 1
            # ascent step
            steps.append({
                "step_index": step_idx, "round": rnd, "direction": "ascent",
                "source_level": 1, "target_level": target,
                "passed": True, "expected_level": target,
                "executor_usage": {"inputTokens": 100, "outputTokens": 50,
                                   "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0},
                "judge_usage": {"inputTokens": 200, "outputTokens": 30,
                                "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0},
                "judge_result": {"detected_level": target, "reasoning": "correct"},
            })
            step_idx += 1
            # descent steps
            for desc in range(target - 1, 0, -1):
                steps.append({
                    "step_index": step_idx, "round": rnd, "direction": "descent",
                    "source_level": desc + 1, "target_level": desc,
                    "passed": True, "expected_level": desc,
                    "executor_usage": {"inputTokens": 100, "outputTokens": 50,
                                       "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0},
                    "judge_usage": {"inputTokens": 200, "outputTokens": 30,
                                    "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0},
                    "judge_result": {"detected_level": desc, "reasoning": "correct"},
                })
                step_idx += 1

        # If there's a failure, mark last step as failed
        if failure:
            if steps:
                steps[-1]["passed"] = False

    return {
        "run_id": run_id,
        "model": model,
        "judge_model": judge_model,
        "timestamp": "2026-01-01T00:00:00Z",
        "max_round": max_round,
        "total_steps": len(steps),
        "total_usage": {"inputTokens": 1000, "outputTokens": 500,
                        "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0},
        "steps": steps,
        "failure": failure,
    }


def _capture_analyze_group(results, label):
    """Run analyze_group and capture stdout."""
    buf = StringIO()
    old_stdout = sys.stdout
    sys.stdout = buf
    try:
        analyze_group(results, label)
    finally:
        sys.stdout = old_stdout
    return buf.getvalue()


def _check_snapshot(name: str, actual: str):
    """Compare actual output to stored snapshot. Update if UPDATE_SNAPSHOTS=1."""
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    snap_path = SNAPSHOTS_DIR / f"{name}.txt"

    if os.environ.get("UPDATE_SNAPSHOTS") == "1":
        snap_path.write_text(actual, encoding="utf-8")
        return

    if not snap_path.exists():
        snap_path.write_text(actual, encoding="utf-8")
        pytest.skip(f"Snapshot created: {snap_path}. Run again to verify.")

    expected = snap_path.read_text(encoding="utf-8")
    assert actual == expected, (
        f"Snapshot mismatch for {name}. "
        f"Run with UPDATE_SNAPSHOTS=1 to update.\n"
        f"Diff:\n{_diff(expected, actual)}"
    )


def _diff(expected: str, actual: str) -> str:
    """Simple line diff for readability."""
    exp_lines = expected.splitlines()
    act_lines = actual.splitlines()
    lines = []
    for i, (e, a) in enumerate(zip(exp_lines, act_lines)):
        if e != a:
            lines.append(f"  line {i+1}:")
            lines.append(f"    expected: {e!r}")
            lines.append(f"    actual:   {a!r}")
    if len(exp_lines) != len(act_lines):
        lines.append(f"  line count: expected {len(exp_lines)}, got {len(act_lines)}")
    return "\n".join(lines[:20])


class TestAnalyzeGroupSnapshots:
    def test_happy_path_3_runs(self):
        results = [
            _make_result("aaaa1111", 1),
            _make_result("bbbb2222", 2),
            _make_result("cccc3333", 3),
        ]
        output = _capture_analyze_group(results, "opus")
        _check_snapshot("happy_3_runs", output)

    def test_all_error_runs(self):
        results = [
            _make_result("err11111", 0, failure={
                "round": 1, "step_index": 0, "expected_level": 2,
                "detected_level": None, "reasoning": "executor failed",
                "error": "call",
            }, steps=[{
                "step_index": 0, "round": 1, "direction": "ascent",
                "source_level": 1, "target_level": 2,
                "passed": False, "expected_level": 2,
                "executor_usage": None, "judge_usage": None,
                "judge_result": None,
            }]),
            _make_result("err22222", 0, failure={
                "round": 1, "step_index": 0, "expected_level": 2,
                "detected_level": None, "reasoning": "judge error",
                "error": "parse",
            }, steps=[{
                "step_index": 0, "round": 1, "direction": "ascent",
                "source_level": 1, "target_level": 2,
                "passed": False, "expected_level": 2,
                "executor_usage": None, "judge_usage": None,
                "judge_result": None,
            }]),
        ]
        output = _capture_analyze_group(results, "error-runs")
        _check_snapshot("all_error_runs", output)

    def test_mixed_with_mismatch(self):
        results = [
            _make_result("good1111", 2),
            _make_result("fail1111", 1, failure={
                "round": 2, "step_index": 2, "expected_level": 3,
                "detected_level": 2, "reasoning": "thought it was 2",
                "error": False,
            }),
            _make_result("fail2222", 0, failure={
                "round": 1, "step_index": 0, "expected_level": 2,
                "detected_level": 1, "reasoning": "too shallow",
                "error": False,
            }, steps=[{
                "step_index": 0, "round": 1, "direction": "ascent",
                "source_level": 1, "target_level": 2,
                "passed": False, "expected_level": 2,
                "executor_usage": None, "judge_usage": None,
                "judge_result": {"detected_level": 1, "reasoning": "too shallow"},
            }]),
        ]
        output = _capture_analyze_group(results, "mixed")
        _check_snapshot("mixed_with_mismatch", output)
