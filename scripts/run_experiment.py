"""Meta-Skill Recursive Experiment Harness.

Orchestrates the recursive skill-creation chain via claude -p CLI calls,
with blind judge validation at each step.

Usage:
    python scripts/run_experiment.py                    # single run (default model: opus)
    python scripts/run_experiment.py --model sonnet     # use Sonnet
    python scripts/run_experiment.py --model haiku      # use Haiku
    python scripts/run_experiment.py --runs 10          # batch of 10
    python scripts/run_experiment.py --max-rounds 5     # cap at 5 rounds
    python scripts/run_experiment.py --bootstrap path   # custom bootstrap skill
"""

import argparse
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Literal, TypedDict

try:
    from scripts.result_schema import validate_result
except ImportError:
    from result_schema import validate_result

PROJECT_ROOT = Path(__file__).resolve().parent.parent

DEFAULT_BOOTSTRAP = Path.home() / (
    ".claude/plugins/marketplaces/claude-plugins-official/"
    "plugins/skill-creator/skills/skill-creator/SKILL.md"
)

EXECUTOR_TEMPLATE = PROJECT_ROOT / "agents" / "executor.md"
JUDGE_TEMPLATE = PROJECT_ROOT / "agents" / "judge.md"
RUNS_DIR = PROJECT_ROOT / "runs"

logger = logging.getLogger("skillception")
logger.setLevel(logging.DEBUG)


def setup_run_logger(run_dir: Path) -> logging.FileHandler:
    """Add a file handler that writes errors to <run_dir>/errors.log.

    Returns the handler so the caller can remove it when the run is done.
    """
    run_dir.mkdir(parents=True, exist_ok=True)
    handler = logging.FileHandler(run_dir / "errors.log", encoding="utf-8")
    handler.setLevel(logging.WARNING)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)
    return handler


class ClaudeResponse(TypedDict):
    result: str
    token_usage: dict | None
    error: str | None  # None = success, str = failure description


def make_env():
    """Create a subprocess environment with CLAUDECODE stripped."""
    return {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}


def level_name(level: int) -> str:
    """Return human-readable name for a meta-level.

    The number of 'Creator's equals the level:
    Level 1 = 'Skill Creator', Level 2 = 'Skill Creator Creator', etc.
    """
    return "Skill" + " Creator" * level


def level_slug(level: int) -> str:
    """Return a kebab-case slug for a meta-level."""
    return "skill" + "-creator" * level


def call_claude(prompt: str, allowed_tools: str | None = None,
                timeout: int = 300, model: str | None = None,
                tmp_dir: Path | None = None,
                runner: Callable[..., subprocess.CompletedProcess] | None = None) -> ClaudeResponse:
    """Call claude -p and return the parsed JSON envelope.

    Writes the prompt to a temp file to avoid Windows command-line length
    limits, then tells Claude to read and follow the instructions in that file.

    Returns ClaudeResponse with keys: result, token_usage, error.
    error is None on success, a description string on failure.
    """
    # Write prompt to temp file (Windows command line can't handle long args)
    effective_tmp = tmp_dir or PROJECT_ROOT
    effective_tmp.mkdir(parents=True, exist_ok=True)
    fd, prompt_file_str = tempfile.mkstemp(suffix=".md", dir=str(effective_tmp))
    prompt_file = Path(prompt_file_str)
    try:
        os.write(fd, prompt.encode("utf-8"))
        os.close(fd)
        prompt_path_str = str(prompt_file).replace("\\", "/")

        short_prompt = (
            f"Read the file at {prompt_path_str} and follow all "
            f"instructions inside it exactly. Do not summarize or explain — "
            f"just execute the instructions."
        )

        cmd = [
            "claude", "-p", short_prompt,
            "--output-format", "json",
            "--max-turns", "10",
        ]
        if model:
            cmd.extend(["--model", model])
        if allowed_tools:
            cmd.extend(["--allowedTools", allowed_tools])

        run = runner or subprocess.run
        try:
            proc = run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(PROJECT_ROOT),
                env=make_env(),
            )
        except subprocess.TimeoutExpired:
            logger.warning("claude -p timed out after %ds | model=%s tools=%s",
                           timeout, model, allowed_tools)
            return {"result": "", "token_usage": None, "error": "timeout"}

        if proc.returncode != 0:
            stderr_snippet = proc.stderr[:500] if proc.stderr else f"exit code {proc.returncode}"
            logger.warning("claude -p failed (rc=%d) | model=%s tools=%s\nstderr: %s",
                           proc.returncode, model, allowed_tools, proc.stderr or "(empty)")
            return {"result": "", "token_usage": None, "error": stderr_snippet}

        # Parse the JSON envelope
        try:
            envelope = json.loads(proc.stdout)
            # Extract per-model token breakdown from modelUsage
            token_usage = None
            model_usage = envelope.get("modelUsage")
            if model_usage:
                # Sum across all models (normally just one)
                token_usage = {
                    "inputTokens": 0,
                    "outputTokens": 0,
                    "cacheReadInputTokens": 0,
                    "cacheCreationInputTokens": 0,
                }
                for counts in model_usage.values():
                    for key in token_usage:
                        token_usage[key] += counts.get(key, 0)
            return {
                "result": envelope.get("result", ""),
                "token_usage": token_usage,
                "error": None,
            }
        except json.JSONDecodeError:
            # Fallback: treat raw stdout as the result
            return {"result": proc.stdout, "token_usage": None, "error": None}
    finally:
        prompt_file.unlink(missing_ok=True)


def extract_json(text: str) -> dict | None:
    """Extract a JSON object from text, handling surrounding prose.

    Pipeline:
      1. Try json.loads on the full stripped text (fast path).
      2. Strip markdown code fences and try json.loads on each fenced block.
      3. Use json.JSONDecoder().raw_decode() scanning from each '{' position.
      4. Return the first object containing "detected_level", or None.
    """
    stripped = text.strip()

    # --- Stage 1: full text fast path ---
    try:
        obj = json.loads(stripped)
        if isinstance(obj, dict):
            return obj
    except (json.JSONDecodeError, ValueError):
        pass

    # --- Stage 2: markdown code fences ---
    fence_pattern = re.compile(r'```(?:json)?\s*\n(.*?)\n\s*```', re.DOTALL)
    for match in fence_pattern.finditer(stripped):
        try:
            obj = json.loads(match.group(1).strip())
            if isinstance(obj, dict) and "detected_level" in obj:
                return obj
        except (json.JSONDecodeError, ValueError):
            continue

    # --- Stage 3: raw_decode from each '{' ---
    decoder = json.JSONDecoder()
    candidates: list[dict] = []
    idx = 0
    while idx < len(stripped):
        pos = stripped.find('{', idx)
        if pos == -1:
            break
        try:
            obj, end = decoder.raw_decode(stripped, pos)
            if isinstance(obj, dict):
                if "detected_level" in obj:
                    return obj
                candidates.append(obj)
            idx = end
        except (json.JSONDecodeError, ValueError):
            idx = pos + 1

    # Return the first dict candidate even without "detected_level", or None
    return candidates[0] if candidates else None


def run_executor(source_content: str, target_level: int,
                 output_dir: Path, model: str | None = None,
                 runner: Callable[..., subprocess.CompletedProcess] | None = None) -> dict:
    """Run the executor agent to generate a skill at the target level.

    Returns dict with keys: success (bool), output_path (str),
    token_usage (dict or None), error (str or None).
    """
    executor_instructions = EXECUTOR_TEMPLATE.read_text(encoding="utf-8")
    output_path = output_dir / level_slug(target_level) / "SKILL.md"
    output_path_str = str(output_path).replace("\\", "/")

    if target_level == 1:
        purpose_line = (
            "This skill's purpose: when someone follows its instructions, "
            "they should produce an **arbitrary skill** (not a skill creator "
            "— a concrete, domain-specific skill of any kind)."
        )
    else:
        purpose_line = (
            f"This skill's purpose: when someone follows its instructions, "
            f"they should produce a **{level_name(target_level - 1)}** "
            f"(level {target_level - 1}) skill."
        )

    prompt = f"""{executor_instructions}

---

## Source Skill Content

{source_content}

---

## Target

Create a **{level_name(target_level)}** (level {target_level}) skill.

{purpose_line}

The name for the generated skill should be: `{level_slug(target_level)}`

The output directory already exists. Write the SKILL.md to: {output_path_str}
"""

    # Pre-create directory
    output_path.parent.mkdir(parents=True, exist_ok=True)

    response = call_claude(prompt, allowed_tools="Read,Write", model=model,
                           tmp_dir=output_dir, runner=runner)

    if response["error"] is not None:
        logger.warning("Executor call failed for level %d: %s", target_level, response["error"])
        return {"success": False, "output_path": str(output_path),
                "token_usage": None, "error": response["error"]}

    # Check if the file was written
    if output_path.exists():
        return {"success": True, "output_path": str(output_path),
                "token_usage": response.get("token_usage"), "error": None}

    logger.warning("Executor did not write output file for level %d: %s", target_level, output_path)
    return {"success": False, "output_path": str(output_path),
            "token_usage": response.get("token_usage"),
            "error": "executor did not write output file"}


def run_judge(skill_content: str, model: str | None = None,
              run_dir: Path | None = None,
              runner: Callable[..., subprocess.CompletedProcess] | None = None) -> dict:
    """Run the judge agent to blindly detect the meta-level.

    Returns dict with keys: detected_level (int | None), reasoning (str),
    token_usage (dict or None), error (str or None).
    """
    judge_instructions = JUDGE_TEMPLATE.read_text(encoding="utf-8")

    prompt = f"""{judge_instructions}

---

## Skill to Evaluate

{skill_content}
"""

    response = call_claude(prompt, model=model, tmp_dir=run_dir, runner=runner)

    if response["error"] is not None:
        logger.warning("Judge call failed: %s", response["error"])
        return {"detected_level": None, "reasoning": "",
                "token_usage": None, "error": response["error"]}

    parsed = extract_json(response["result"])
    if parsed and "detected_level" in parsed:
        return {
            "detected_level": parsed["detected_level"],
            "reasoning": parsed.get("reasoning", ""),
            "token_usage": response.get("token_usage"),
            "error": None,
        }

    raw_preview = response["result"][:500]
    logger.warning("Judge response unparseable:\n%s", raw_preview)
    return {"detected_level": None, "reasoning": "",
            "token_usage": response.get("token_usage"),
            "error": f"could not parse judge response: {response['result'][:200]}"}


EMPTY_USAGE = {
    "inputTokens": 0,
    "outputTokens": 0,
    "cacheReadInputTokens": 0,
    "cacheCreationInputTokens": 0,
}


def sum_token_usage(steps: list[dict]) -> dict:
    """Sum executor_usage and judge_usage across all steps."""
    total = dict(EMPTY_USAGE)
    for step in steps:
        for key in ("executor_usage", "judge_usage"):
            usage = step.get(key)
            if usage:
                for field in total:
                    total[field] += usage.get(field, 0)
    return total


EXECUTOR_RETRIES = 2
JUDGE_RETRIES = 2


def run_executor_with_retries(source_content: str, target_level: int,
                              output_dir: Path, model: str | None = None,
                              runner: Callable[..., subprocess.CompletedProcess] | None = None) -> dict:
    """Run the executor, retrying up to EXECUTOR_RETRIES times on errors."""
    for attempt in range(1 + EXECUTOR_RETRIES):
        exec_result = run_executor(source_content, target_level, output_dir,
                                   model=model, runner=runner)
        if exec_result["success"]:
            return exec_result
        if attempt < EXECUTOR_RETRIES:
            print(f"    Executor error (attempt {attempt + 1}/{1 + EXECUTOR_RETRIES}), retrying: {exec_result.get('error')}")
        else:
            print(f"    Executor error (attempt {attempt + 1}/{1 + EXECUTOR_RETRIES}), all retries exhausted: {exec_result.get('error')}")
    return exec_result


def run_judge_with_retries(skill_content: str, model: str | None = None,
                           run_dir: Path | None = None,
                           runner: Callable[..., subprocess.CompletedProcess] | None = None) -> dict:
    """Run the judge, retrying up to JUDGE_RETRIES times on errors."""
    for attempt in range(1 + JUDGE_RETRIES):
        judge_result = run_judge(skill_content, model=model, run_dir=run_dir,
                                 runner=runner)
        if not judge_result.get("error"):
            return judge_result
        if attempt < JUDGE_RETRIES:
            print(f"    Judge error (attempt {attempt + 1}/{1 + JUDGE_RETRIES}), retrying: {judge_result['error']}")
        else:
            print(f"    Judge error (attempt {attempt + 1}/{1 + JUDGE_RETRIES}), all retries exhausted: {judge_result['error']}")
    return judge_result


def _run_step(source_content: str, source_path: str, source_level: int,
              target_level: int, direction: str, round_num: int,
              step_index: int,
              executor: Callable[[str, int, int], dict],
              judge: Callable[[str], dict]) -> tuple[dict, str | None]:
    """Run one executor+judge step and return (step_record, generated_content).

    generated_content is None if the step failed.
    """
    print(f"  Step {step_index + 1}: {direction.title()} — {level_name(source_level)} → {level_name(target_level)}")

    exec_result = executor(source_content, target_level, step_index)

    step_record = {
        "step_index": step_index,
        "round": round_num,
        "direction": direction,
        "source_level": source_level,
        "target_level": target_level,
        "source_path": source_path,
        "output_path": exec_result.get("output_path", ""),
        "passed": False,
        "executor_usage": exec_result.get("token_usage"),
    }

    if not exec_result["success"]:
        step_record["judge_result"] = None
        step_record["expected_level"] = target_level
        step_record["judge_usage"] = None
        return step_record, None

    generated_content = exec_result["output_content"]
    judge_result = judge(generated_content)

    step_record["judge_result"] = {
        "detected_level": judge_result["detected_level"],
        "reasoning": judge_result["reasoning"],
    }
    step_record["expected_level"] = target_level
    step_record["judge_usage"] = judge_result.get("token_usage")

    if not judge_result.get("error"):
        step_record["passed"] = judge_result["detected_level"] == target_level

    # Preserve judge error string for caller to classify (not stored in result.json)
    step_record["_judge_error"] = judge_result.get("error")

    return step_record, generated_content


ErrorKind = Literal[False, "call", "parse"]


def _make_failure(round_num: int, step_index: int, expected: int,
                  detected, reasoning: str, error: ErrorKind) -> dict:
    """Build a failure record."""
    return {
        "round": round_num,
        "step_index": step_index,
        "expected_level": expected,
        "detected_level": detected,
        "reasoning": reasoning,
        "error": error,
    }


def _classify_judge_error(judge_error: str | None) -> ErrorKind:
    """Classify a judge error string into 'call' or 'parse'."""
    if judge_error and judge_error.startswith("could not parse"):
        return "parse"
    return "call"


def run_rounds(
    bootstrap_content: str,
    bootstrap_path: str,
    max_rounds: int,
    executor: Callable[[str, int, int], dict],
    judge: Callable[[str], dict],
) -> dict:
    """Run the ascent/descent state machine and return the result dict.

    executor signature: (source_content, target_level, step_index) -> dict
      Returns: {"success": bool, "output_path": str, "output_content": str | None,
                "token_usage": dict | None, "error": str | None}

    judge signature: (skill_content) -> dict
      Returns: {"detected_level": int | None, "reasoning": str,
                "token_usage": dict | None, "error": str | None}

    Returns a partial result dict (steps, failure, max_round, total_steps,
    total_usage). The caller adds run_id, model, timestamp, etc.
    """
    steps: list[dict] = []
    current_sc_content = bootstrap_content
    current_sc_path = bootstrap_path
    step_index = 0
    max_round_reached = 0

    def _finish(failure=None):
        # Strip internal keys before serialization
        for s in steps:
            s.pop("_judge_error", None)
        return {
            "max_round": max_round_reached,
            "total_steps": len(steps),
            "steps": steps,
            "failure": failure,
            "total_usage": sum_token_usage(steps),
        }

    for round_num in range(1, max_rounds + 1):
        target_ascent_level = round_num + 1
        print(f"\n--- Round {round_num} (ascend to level {target_ascent_level}, then descend) ---")

        # === ASCENT ===
        step_record, gen_content = _run_step(
            current_sc_content, current_sc_path, 1, target_ascent_level,
            "ascent", round_num, step_index, executor, judge)
        steps.append(step_record)

        if gen_content is None:  # executor failed
            print(f"    FAIL (executor)")
            return _finish(_make_failure(
                round_num, step_index, target_ascent_level, None,
                "executor failed",
                error="call"))

        judge_res = step_record["judge_result"]
        step_index += 1

        if not step_record["passed"]:
            detected = judge_res["detected_level"]
            reasoning = judge_res["reasoning"]
            if detected is None:
                error = _classify_judge_error(step_record.get("_judge_error"))
                print(f"    FAIL (judge {error})")
            else:
                error: ErrorKind = False
                print(f"    FAIL: expected level {target_ascent_level}, got {detected}")
            return _finish(_make_failure(
                round_num, step_index - 1, target_ascent_level,
                detected, reasoning, error=error))

        print(f"    PASS (level {judge_res['detected_level']})")

        # === DESCENT ===
        descent_source_content = gen_content
        descent_source_path = step_record["output_path"]
        descent_source_level = target_ascent_level

        for descent_target in range(target_ascent_level - 1, 0, -1):
            step_record, gen_content = _run_step(
                descent_source_content, descent_source_path,
                descent_source_level, descent_target,
                "descent", round_num, step_index, executor, judge)
            steps.append(step_record)

            if gen_content is None:  # executor failed
                print(f"    FAIL (executor)")
                return _finish(_make_failure(
                    round_num, step_index, descent_target, None,
                    "executor failed",
                    error="call"))

            judge_res = step_record["judge_result"]
            step_index += 1

            if not step_record["passed"]:
                detected = judge_res["detected_level"]
                reasoning = judge_res["reasoning"]
                if detected is None:
                    error = _classify_judge_error(step_record.get("_judge_error"))
                    print(f"    FAIL (judge {error})")
                else:
                    error: ErrorKind = False
                    print(f"    FAIL: expected level {descent_target}, got {detected}")
                return _finish(_make_failure(
                    round_num, step_index - 1, descent_target,
                    detected, reasoning, error=error))

            print(f"    PASS (level {judge_res['detected_level']})")

            descent_source_content = gen_content
            descent_source_path = step_record["output_path"]
            descent_source_level = descent_target

        # Round completed
        current_sc_content = descent_source_content
        current_sc_path = descent_source_path
        max_round_reached = round_num
        print(f"  Round {round_num} complete!")

    print(f"\nRun complete. Reached round {max_round_reached}. Total steps: {step_index}.")
    return _finish()


def run_single_experiment(run_id: str, bootstrap_path: Path,
                          max_rounds: int, model: str | None = None,
                          judge_model: str | None = None) -> dict:
    """Execute one full experiment run.

    Thin orchestrator that wires up real executor/judge calls and
    filesystem I/O, then delegates to run_rounds() for the state machine.
    """
    print(f"\n{'='*60}")
    print(f"Run {run_id} (model: {model or 'default'})")
    print(f"{'='*60}")

    bootstrap_content = bootstrap_path.read_text(encoding="utf-8")
    run_dir = RUNS_DIR / run_id
    skills_dir = run_dir / "skills"
    log_handler = setup_run_logger(run_dir)

    def executor(source_content: str, target_level: int, step_index: int) -> dict:
        step_dir = skills_dir / f"step-{step_index:02d}"
        result = run_executor_with_retries(source_content, target_level, step_dir, model=model)
        if result["success"]:
            result["output_content"] = Path(result["output_path"]).read_text(encoding="utf-8")
        else:
            result["output_content"] = None
        return result

    def judge(skill_content: str) -> dict:
        return run_judge_with_retries(skill_content, model=judge_model, run_dir=run_dir)

    try:
        rounds_result = run_rounds(
            bootstrap_content, str(bootstrap_path), max_rounds,
            executor, judge)
    finally:
        logger.removeHandler(log_handler)
        log_handler.close()
        # Clean up empty error logs (no warnings = no errors)
        error_log = run_dir / "errors.log"
        if error_log.exists() and error_log.stat().st_size == 0:
            error_log.unlink()

    return {
        "run_id": run_id,
        "model": model or "default",
        "judge_model": judge_model or "default",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **rounds_result,
    }


def main():
    parser = argparse.ArgumentParser(description="Meta-Skill Recursive Experiment")
    parser.add_argument("--runs", type=int, default=1,
                        help="Number of experiment runs (default: 1)")
    parser.add_argument("--max-rounds", type=int, default=9,
                        help="Maximum rounds per run (default: 9)")
    parser.add_argument("--model", type=str, default="opus",
                        help="Claude model for the executor (e.g. opus, sonnet, haiku)")
    parser.add_argument("--judge-model", type=str, default="opus",
                        help="Claude model for the judge (default: opus)")
    parser.add_argument("--bootstrap", type=Path, default=DEFAULT_BOOTSTRAP,
                        help="Path to bootstrap skill-creator SKILL.md")
    args = parser.parse_args()

    # Validate bootstrap
    if not args.bootstrap.exists():
        print(f"ERROR: Bootstrap file not found: {args.bootstrap}", file=sys.stderr)
        sys.exit(1)

    # Ensure output dirs
    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    for i in range(args.runs):
        run_id = str(uuid.uuid4())[:8]
        result = run_single_experiment(run_id, args.bootstrap, args.max_rounds, model=args.model, judge_model=args.judge_model)

        # Validate result against schema before saving
        schema_errors = validate_result(result)
        if schema_errors:
            print(f"WARNING: result failed schema validation:", file=sys.stderr)
            for err in schema_errors:
                print(f"  - {err}", file=sys.stderr)

        # Save result
        run_dir = RUNS_DIR / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        result_path = run_dir / "result.json"
        result_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"Result saved: {result_path}")

        if args.runs > 1:
            max_r = result["max_round"]
            status = "PASS" if result["failure"] is None else f"FAIL at round {result['failure']['round']}"
            print(f"  [{i+1}/{args.runs}] {status} (max round: {max_r})")


if __name__ == "__main__":
    main()
