"""Tests for the run_rounds() state machine."""

import pytest

from scripts.run_experiment import run_rounds


def make_executor(results=None, fail_at=None):
    """Create a fake executor callable.

    results: if provided, a list of output_content strings to return in order.
    fail_at: set of step_indices where the executor should fail.
    """
    call_count = [0]
    fail_at = fail_at or set()

    def executor(source_content: str, target_level: int, step_index: int) -> dict:
        idx = call_count[0]
        call_count[0] += 1

        if step_index in fail_at:
            return {
                "success": False,
                "output_path": f"/fake/step-{step_index:02d}/skill/SKILL.md",
                "output_content": None,
                "token_usage": None,
                "error": "executor error",
            }

        content = f"# Level {target_level} skill content"
        if results and idx < len(results):
            content = results[idx]

        return {
            "success": True,
            "output_path": f"/fake/step-{step_index:02d}/skill/SKILL.md",
            "output_content": content,
            "token_usage": {"inputTokens": 100, "outputTokens": 50,
                            "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0},
            "error": None,
        }

    return executor


def make_judge(wrong_at=None, error_at=None, indeterminate_at=None):
    """Create a fake judge callable.

    wrong_at: dict mapping call index -> wrong detected_level to return.
    error_at: set of call indices where the judge should return a parse error.
    indeterminate_at: set of call indices where the judge returns -1 (incoherent skill).
    """
    call_count = [0]
    wrong_at = wrong_at or {}
    error_at = error_at or set()
    indeterminate_at = indeterminate_at or set()
    # Track what levels were requested for verification
    levels_seen = []

    def judge(skill_content: str) -> dict:
        idx = call_count[0]
        call_count[0] += 1

        if idx in error_at:
            return {
                "detected_level": None,
                "reasoning": "",
                "token_usage": None,
                "error": "could not parse judge response: garbled",
            }

        if idx in indeterminate_at:
            return {
                "detected_level": -1,
                "reasoning": "skill is incoherent and contradictory",
                "token_usage": {"inputTokens": 200, "outputTokens": 30,
                                "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0},
                "error": None,
            }

        # Infer expected level from the content pattern set by make_executor
        # The executor writes "Level N" in the content
        import re
        m = re.search(r"Level (\d+)", skill_content)
        expected = int(m.group(1)) if m else 0
        levels_seen.append(expected)

        if idx in wrong_at:
            return {
                "detected_level": wrong_at[idx],
                "reasoning": f"thought it was level {wrong_at[idx]}",
                "token_usage": {"inputTokens": 200, "outputTokens": 30,
                                "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0},
                "error": None,
            }

        return {
            "detected_level": expected,
            "reasoning": f"correctly identified as level {expected}",
            "token_usage": {"inputTokens": 200, "outputTokens": 30,
                            "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0},
            "error": None,
        }

    return judge


class TestRunRoundsHappyPath:
    def test_single_round_success(self):
        """Round 1: ascend to level 2, descend back to level 1."""
        result = run_rounds("bootstrap", "/bootstrap", 1,
                            make_executor(), make_judge())
        assert result["failure"] is None
        assert result["max_round"] == 1
        # Round 1: ascent (step 0) + descent (step 1) = 2 steps
        assert result["total_steps"] == 2
        assert len(result["steps"]) == 2
        assert result["steps"][0]["direction"] == "ascent"
        assert result["steps"][1]["direction"] == "descent"

    def test_two_rounds_success(self):
        """Round 1: ascend 2, descend 1. Round 2: ascend 3, descend 2, descend 1."""
        result = run_rounds("bootstrap", "/bootstrap", 2,
                            make_executor(), make_judge())
        assert result["failure"] is None
        assert result["max_round"] == 2
        # Round 1: 2 steps, Round 2: 3 steps (ascend + 2 descents)
        assert result["total_steps"] == 5

    def test_token_usage_aggregated(self):
        result = run_rounds("bootstrap", "/bootstrap", 1,
                            make_executor(), make_judge())
        assert result["total_usage"]["inputTokens"] > 0
        assert result["total_usage"]["outputTokens"] > 0


class TestRunRoundsAscentFailures:
    def test_executor_failure_on_ascent(self):
        """Executor fails on the very first step."""
        result = run_rounds("bootstrap", "/bootstrap", 3,
                            make_executor(fail_at={0}), make_judge())
        assert result["failure"] is not None
        assert result["failure"]["error"] == "call"
        assert result["failure"]["detected_level"] is None
        assert result["total_steps"] == 1
        assert result["max_round"] == 0

    def test_judge_mismatch_on_ascent(self):
        """Judge returns wrong level on ascent step."""
        result = run_rounds("bootstrap", "/bootstrap", 3,
                            make_executor(), make_judge(wrong_at={0: 99}))
        assert result["failure"] is not None
        assert result["failure"]["error"] is False
        assert result["failure"]["detected_level"] == 99
        assert result["failure"]["expected_level"] == 2  # round 1 ascends to level 2

    def test_judge_error_on_ascent(self):
        """Judge returns parse error on ascent step."""
        result = run_rounds("bootstrap", "/bootstrap", 3,
                            make_executor(), make_judge(error_at={0}))
        assert result["failure"] is not None
        assert result["failure"]["error"] == "parse"
        assert result["failure"]["detected_level"] is None

    def test_judge_indeterminate_on_ascent(self):
        """Judge returns -1 for incoherent skill — legitimate mismatch, not error."""
        result = run_rounds("bootstrap", "/bootstrap", 3,
                            make_executor(), make_judge(indeterminate_at={0}))
        assert result["failure"] is not None
        assert result["failure"]["error"] is False
        assert result["failure"]["detected_level"] == -1
        assert result["failure"]["expected_level"] == 2


class TestRunRoundsDescentFailures:
    def test_executor_failure_on_descent(self):
        """Ascent passes, executor fails on descent."""
        result = run_rounds("bootstrap", "/bootstrap", 1,
                            make_executor(fail_at={1}), make_judge())
        assert result["failure"] is not None
        assert result["failure"]["error"] == "call"
        assert result["steps"][0]["passed"] is True   # ascent passed
        assert result["steps"][1]["passed"] is False   # descent failed

    def test_judge_mismatch_on_descent(self):
        """Ascent passes, judge returns wrong level on descent."""
        result = run_rounds("bootstrap", "/bootstrap", 1,
                            make_executor(), make_judge(wrong_at={1: 99}))
        assert result["failure"] is not None
        assert result["failure"]["error"] is False
        assert result["failure"]["detected_level"] == 99
        assert result["failure"]["expected_level"] == 1  # descending to level 1

    def test_judge_indeterminate_on_descent(self):
        """Judge returns -1 on descent — legitimate, not error."""
        result = run_rounds("bootstrap", "/bootstrap", 1,
                            make_executor(), make_judge(indeterminate_at={1}))
        assert result["failure"] is not None
        assert result["failure"]["error"] is False
        assert result["failure"]["detected_level"] == -1


class TestRunRoundsMultiRound:
    def test_passes_round1_fails_round2(self):
        """Completes round 1, fails on round 2 ascent."""
        # Round 1: 2 judge calls (indices 0, 1). Round 2 ascent: index 2.
        result = run_rounds("bootstrap", "/bootstrap", 3,
                            make_executor(), make_judge(wrong_at={2: 0}))
        assert result["max_round"] == 1  # completed round 1
        assert result["failure"] is not None
        assert result["failure"]["round"] == 2


class TestRunRoundsStepRecordStructure:
    def test_step_has_all_keys(self):
        result = run_rounds("bootstrap", "/bootstrap", 1,
                            make_executor(), make_judge())
        step = result["steps"][0]
        required_keys = {
            "step_index", "round", "direction", "source_level",
            "target_level", "source_path", "output_path", "passed",
            "executor_usage", "judge_usage", "judge_result", "expected_level",
        }
        assert required_keys.issubset(set(step.keys()))

    def test_ascent_source_level_is_1(self):
        result = run_rounds("bootstrap", "/bootstrap", 1,
                            make_executor(), make_judge())
        assert result["steps"][0]["source_level"] == 1

    def test_descent_source_level_matches_ascent_target(self):
        result = run_rounds("bootstrap", "/bootstrap", 1,
                            make_executor(), make_judge())
        ascent = result["steps"][0]
        descent = result["steps"][1]
        assert descent["source_level"] == ascent["target_level"]
