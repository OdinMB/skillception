"""Tests for pure helper functions in run_experiment.py."""

import os
from unittest.mock import patch

import pytest

from scripts.run_experiment import (
    extract_json,
    level_name,
    level_slug,
    make_env,
    sum_token_usage,
)


# --- extract_json ---

class TestExtractJson:
    def test_plain_json(self):
        text = '{"detected_level": 3, "reasoning": "clearly a level 3"}'
        result = extract_json(text)
        assert result == {"detected_level": 3, "reasoning": "clearly a level 3"}

    def test_prose_wrapper(self):
        text = "Here is my analysis:\n{\"detected_level\": 2, \"reasoning\": \"meta\"}\nHope that helps!"
        result = extract_json(text)
        assert result["detected_level"] == 2

    def test_markdown_fenced(self):
        text = "Some text\n```json\n{\"detected_level\": 1, \"reasoning\": \"ok\"}\n```\nMore text"
        result = extract_json(text)
        assert result["detected_level"] == 1

    def test_markdown_fenced_no_lang(self):
        text = "Result:\n```\n{\"detected_level\": 4, \"reasoning\": \"deep\"}\n```"
        result = extract_json(text)
        assert result["detected_level"] == 4

    def test_nested_braces_in_reasoning(self):
        text = '{"detected_level": 2, "reasoning": "uses {meta} patterns and {nested: {deep}} stuff"}'
        result = extract_json(text)
        assert result["detected_level"] == 2
        assert "{meta}" in result["reasoning"]

    def test_multiple_objects_picks_detected_level(self):
        text = 'distractor: {"foo": "bar"}\nreal: {"detected_level": 5, "reasoning": "yes"}'
        result = extract_json(text)
        assert result["detected_level"] == 5

    def test_no_json(self):
        assert extract_json("just plain text with no json at all") is None

    def test_empty_string(self):
        assert extract_json("") is None

    def test_whitespace_only(self):
        assert extract_json("   \n\t  ") is None

    def test_extra_keys_preserved(self):
        text = '{"detected_level": 1, "reasoning": "ok", "confidence": 0.9}'
        result = extract_json(text)
        assert result["confidence"] == 0.9

    def test_full_text_non_dict(self):
        """json.loads of a list should not be returned."""
        text = '[1, 2, 3]'
        assert extract_json(text) is None

    def test_detected_level_negative_one(self):
        """Judge returns -1 for incoherent skill — must parse correctly."""
        text = '{"detected_level": -1, "reasoning": "skill is contradictory"}'
        result = extract_json(text)
        assert result is not None
        assert result["detected_level"] == -1
        assert result["reasoning"] == "skill is contradictory"


# --- level_name ---

class TestLevelName:
    def test_level_0(self):
        assert level_name(0) == "Skill"

    def test_level_1(self):
        assert level_name(1) == "Skill Creator"

    def test_level_3(self):
        assert level_name(3) == "Skill Creator Creator Creator"


# --- level_slug ---

class TestLevelSlug:
    def test_level_0(self):
        assert level_slug(0) == "skill"

    def test_level_1(self):
        assert level_slug(1) == "skill-creator"

    def test_level_3(self):
        assert level_slug(3) == "skill-creator-creator-creator"


# --- sum_token_usage ---

class TestSumTokenUsage:
    def test_empty_list(self):
        result = sum_token_usage([])
        assert result == {
            "inputTokens": 0,
            "outputTokens": 0,
            "cacheReadInputTokens": 0,
            "cacheCreationInputTokens": 0,
        }

    def test_none_usage_skipped(self):
        steps = [
            {"executor_usage": None, "judge_usage": None},
            {"executor_usage": None},
        ]
        result = sum_token_usage(steps)
        assert result["inputTokens"] == 0

    def test_mixed_steps(self):
        steps = [
            {
                "executor_usage": {"inputTokens": 100, "outputTokens": 50,
                                   "cacheReadInputTokens": 10, "cacheCreationInputTokens": 5},
                "judge_usage": {"inputTokens": 200, "outputTokens": 30,
                                "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0},
            },
            {
                "executor_usage": {"inputTokens": 150, "outputTokens": 60,
                                   "cacheReadInputTokens": 20, "cacheCreationInputTokens": 0},
                "judge_usage": None,
            },
        ]
        result = sum_token_usage(steps)
        assert result["inputTokens"] == 450
        assert result["outputTokens"] == 140
        assert result["cacheReadInputTokens"] == 30
        assert result["cacheCreationInputTokens"] == 5

    def test_partial_keys_treated_as_zero(self):
        steps = [
            {"executor_usage": {"inputTokens": 100}, "judge_usage": None},
        ]
        result = sum_token_usage(steps)
        assert result["inputTokens"] == 100
        assert result["outputTokens"] == 0


# --- make_env ---

class TestMakeEnv:
    def test_strips_claudecode(self):
        with patch.dict(os.environ, {"CLAUDECODE": "1", "PATH": "/usr/bin"}, clear=False):
            env = make_env()
            assert "CLAUDECODE" not in env
            assert "PATH" in env

    def test_works_without_claudecode(self):
        original = os.environ.pop("CLAUDECODE", None)
        try:
            env = make_env()
            assert "CLAUDECODE" not in env
        finally:
            if original is not None:
                os.environ["CLAUDECODE"] = original

    def test_preserves_other_vars(self):
        with patch.dict(os.environ, {"MY_VAR": "hello"}, clear=False):
            env = make_env()
            assert env["MY_VAR"] == "hello"
