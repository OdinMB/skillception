"""Integration tests for call_claude, run_executor, run_judge using runner injection."""

import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from scripts.run_experiment import (
    call_claude,
    run_executor,
    run_judge,
    run_judge_with_retries,
    EXECUTOR_TEMPLATE,
    JUDGE_TEMPLATE,
    PROJECT_ROOT,
)


def make_fake_runner(stdout="", stderr="", returncode=0):
    """Create a fake subprocess runner returning canned output."""
    def runner(*args, **kwargs):
        return subprocess.CompletedProcess(
            args=args[0] if args else [],
            returncode=returncode,
            stdout=stdout,
            stderr=stderr,
        )
    return runner


def make_claude_envelope(result_text="done", model_usage=None):
    """Build a JSON string matching Claude's --output-format json envelope."""
    envelope = {"result": result_text}
    if model_usage:
        envelope["modelUsage"] = model_usage
    return json.dumps(envelope)


# --- call_claude ---

class TestCallClaude:
    def test_success_returns_all_keys(self, tmp_path):
        envelope = make_claude_envelope("hello world")
        runner = make_fake_runner(stdout=envelope)
        result = call_claude("test prompt", tmp_dir=tmp_path, runner=runner)
        assert result["result"] == "hello world"
        assert result["error"] is None
        assert "token_usage" in result

    def test_error_returns_all_keys(self, tmp_path):
        runner = make_fake_runner(returncode=1, stderr="bad stuff")
        result = call_claude("test prompt", tmp_dir=tmp_path, runner=runner)
        assert result["error"] is not None
        assert "bad stuff" in result["error"]
        assert result["result"] == ""
        assert result["token_usage"] is None

    def test_timeout_returns_error(self, tmp_path):
        def timeout_runner(*args, **kwargs):
            raise subprocess.TimeoutExpired(cmd="claude", timeout=10)
        result = call_claude("test prompt", tmp_dir=tmp_path, runner=timeout_runner)
        assert result["error"] == "timeout"

    def test_token_usage_extracted(self, tmp_path):
        envelope = make_claude_envelope(
            "ok",
            model_usage={"claude-opus": {
                "inputTokens": 500, "outputTokens": 200,
                "cacheReadInputTokens": 50, "cacheCreationInputTokens": 10,
            }}
        )
        runner = make_fake_runner(stdout=envelope)
        result = call_claude("test prompt", tmp_dir=tmp_path, runner=runner)
        assert result["token_usage"]["inputTokens"] == 500
        assert result["token_usage"]["outputTokens"] == 200

    def test_runner_receives_correct_flags(self, tmp_path):
        calls = []
        def spy_runner(*args, **kwargs):
            calls.append((args, kwargs))
            return subprocess.CompletedProcess(
                args=args[0], returncode=0,
                stdout=make_claude_envelope("ok"), stderr="")
        call_claude("test", allowed_tools="Read,Write", model="sonnet",
                    tmp_dir=tmp_path, runner=spy_runner)
        cmd = calls[0][0][0]
        assert "--output-format" in cmd
        assert "--max-turns" in cmd
        assert "--allowedTools" in cmd
        assert "Read,Write" in cmd
        assert "--model" in cmd
        assert "sonnet" in cmd

    def test_claudecode_stripped_from_env(self, tmp_path):
        calls = []
        def spy_runner(*args, **kwargs):
            calls.append(kwargs.get("env", {}))
            return subprocess.CompletedProcess(
                args=args[0], returncode=0,
                stdout=make_claude_envelope("ok"), stderr="")
        with patch.dict("os.environ", {"CLAUDECODE": "1"}):
            call_claude("test", tmp_dir=tmp_path, runner=spy_runner)
        assert "CLAUDECODE" not in calls[0]

    def test_malformed_json_fallback(self, tmp_path):
        runner = make_fake_runner(stdout="not json at all")
        result = call_claude("test", tmp_dir=tmp_path, runner=runner)
        assert result["error"] is None
        assert result["result"] == "not json at all"

    def test_temp_file_cleaned_up(self, tmp_path):
        runner = make_fake_runner(stdout=make_claude_envelope("ok"))
        call_claude("test prompt", tmp_dir=tmp_path, runner=runner)
        md_files = list(tmp_path.glob("*.md"))
        assert len(md_files) == 0, f"temp file not cleaned up: {md_files}"


# --- run_executor ---

class TestRunExecutor:
    def test_success_when_file_written(self, tmp_path):
        output_dir = tmp_path / "step-00"
        def runner(*args, **kwargs):
            # Simulate executor writing the file
            skill_dir = output_dir / "skill-creator"
            skill_dir.mkdir(parents=True, exist_ok=True)
            (skill_dir / "SKILL.md").write_text("# Skill", encoding="utf-8")
            return subprocess.CompletedProcess(
                args=args[0], returncode=0,
                stdout=make_claude_envelope("done"), stderr="")
        result = run_executor("source content", 1, output_dir, runner=runner)
        assert result["success"] is True
        assert result["error"] is None

    def test_failure_when_file_not_written(self, tmp_path):
        output_dir = tmp_path / "step-00"
        runner = make_fake_runner(stdout=make_claude_envelope("done"))
        result = run_executor("source content", 1, output_dir, runner=runner)
        assert result["success"] is False
        assert "did not write" in result["error"]

    def test_failure_on_claude_error(self, tmp_path):
        output_dir = tmp_path / "step-00"
        runner = make_fake_runner(returncode=1, stderr="process error")
        result = run_executor("source content", 1, output_dir, runner=runner)
        assert result["success"] is False


# --- run_judge ---

class TestRunJudge:
    def test_successful_parse(self, tmp_path):
        judge_json = json.dumps({"detected_level": 2, "reasoning": "meta enough"})
        envelope = make_claude_envelope(judge_json)
        runner = make_fake_runner(stdout=envelope)
        result = run_judge("skill content", run_dir=tmp_path, runner=runner)
        assert result["detected_level"] == 2
        assert result["error"] is None

    def test_parse_failure_returns_none_level(self, tmp_path):
        envelope = make_claude_envelope("I have no idea what this is")
        runner = make_fake_runner(stdout=envelope)
        result = run_judge("skill content", run_dir=tmp_path, runner=runner)
        assert result["detected_level"] is None
        assert result["error"] is not None

    def test_claude_error_returns_none_level(self, tmp_path):
        runner = make_fake_runner(returncode=1, stderr="boom")
        result = run_judge("skill content", run_dir=tmp_path, runner=runner)
        assert result["detected_level"] is None
        assert result["error"] is not None


# --- run_judge_with_retries ---

class TestRunJudgeWithRetries:
    def test_retries_on_error(self, tmp_path):
        call_count = [0]
        def counting_runner(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] <= 2:
                return subprocess.CompletedProcess(
                    args=args[0], returncode=0,
                    stdout=make_claude_envelope("gibberish"), stderr="")
            judge_json = json.dumps({"detected_level": 1, "reasoning": "ok"})
            return subprocess.CompletedProcess(
                args=args[0], returncode=0,
                stdout=make_claude_envelope(judge_json), stderr="")
        result = run_judge_with_retries("content", run_dir=tmp_path, runner=counting_runner)
        assert result["detected_level"] == 1
        assert call_count[0] == 3

    def test_exhausted_retries(self, tmp_path):
        runner = make_fake_runner(stdout=make_claude_envelope("nope"))
        result = run_judge_with_retries("content", run_dir=tmp_path, runner=runner)
        assert result["error"] is not None
        assert result["detected_level"] is None
