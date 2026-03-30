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
import os
import re
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

DEFAULT_BOOTSTRAP = Path.home() / (
    ".claude/plugins/marketplaces/claude-plugins-official/"
    "plugins/skill-creator/skills/skill-creator/SKILL.md"
)

EXECUTOR_TEMPLATE = PROJECT_ROOT / "agents" / "executor.md"
JUDGE_TEMPLATE = PROJECT_ROOT / "agents" / "judge.md"
RUNS_DIR = PROJECT_ROOT / "runs"


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
                tmp_dir: Path | None = None) -> dict:
    """Call claude -p and return the parsed JSON envelope.

    Writes the prompt to a temp file to avoid Windows command-line length
    limits, then tells Claude to read and follow the instructions in that file.

    Returns dict with keys: result (str), usage (dict or None).
    On failure, returns {"result": "", "error": str}.
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

        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(PROJECT_ROOT),
                env=make_env(),
            )
        except subprocess.TimeoutExpired:
            return {"result": "", "error": "timeout"}

        if proc.returncode != 0:
            return {"result": "", "error": proc.stderr[:500] if proc.stderr else f"exit code {proc.returncode}"}

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
            }
        except json.JSONDecodeError:
            # Fallback: treat raw stdout as the result
            return {"result": proc.stdout, "token_usage": None}
    finally:
        prompt_file.unlink(missing_ok=True)


def extract_json(text: str) -> dict | None:
    """Extract a JSON object from text, handling surrounding prose."""
    # Try parsing the whole thing first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try each {...} block in the text (allow nested braces for reasoning strings)
    for match in re.finditer(r'\{.*?\}', text, re.DOTALL):
        try:
            obj = json.loads(match.group())
            if "detected_level" in obj:
                return obj
        except json.JSONDecodeError:
            continue

    return None


def run_executor(source_content: str, target_level: int,
                 output_dir: Path, model: str | None = None) -> dict:
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
                           tmp_dir=output_dir)

    if "error" in response:
        return {"success": False, "output_path": str(output_path),
                "token_usage": None, "error": response["error"]}

    # Check if the file was written
    if output_path.exists():
        return {"success": True, "output_path": str(output_path),
                "token_usage": response.get("token_usage"), "error": None}

    return {"success": False, "output_path": str(output_path),
            "token_usage": response.get("token_usage"),
            "error": "executor did not write output file"}


def run_judge(skill_content: str, model: str | None = None,
              run_dir: Path | None = None) -> dict:
    """Run the judge agent to blindly detect the meta-level.

    Returns dict with keys: detected_level (int), reasoning (str),
    token_usage (dict or None), error (str or None).
    """
    judge_instructions = JUDGE_TEMPLATE.read_text(encoding="utf-8")

    prompt = f"""{judge_instructions}

---

## Skill to Evaluate

{skill_content}
"""

    response = call_claude(prompt, model=model, tmp_dir=run_dir)

    if "error" in response:
        return {"detected_level": -1, "reasoning": "",
                "token_usage": None, "error": response["error"]}

    parsed = extract_json(response["result"])
    if parsed and "detected_level" in parsed:
        return {
            "detected_level": parsed["detected_level"],
            "reasoning": parsed.get("reasoning", ""),
            "token_usage": response.get("token_usage"),
            "error": None,
        }

    return {"detected_level": -1, "reasoning": "",
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


JUDGE_RETRIES = 2


def run_judge_with_retries(skill_content: str, model: str | None = None,
                           run_dir: Path | None = None) -> dict:
    """Run the judge, retrying up to JUDGE_RETRIES times on errors."""
    for attempt in range(1 + JUDGE_RETRIES):
        judge_result = run_judge(skill_content, model=model, run_dir=run_dir)
        if not judge_result.get("error"):
            return judge_result
        if attempt < JUDGE_RETRIES:
            print(f"    Judge error (attempt {attempt + 1}/{1 + JUDGE_RETRIES}), retrying: {judge_result['error']}")
        else:
            print(f"    Judge error (attempt {attempt + 1}/{1 + JUDGE_RETRIES}), all retries exhausted: {judge_result['error']}")
    return judge_result


def run_single_experiment(run_id: str, bootstrap_path: Path,
                          max_rounds: int, model: str | None = None,
                          judge_model: str | None = None) -> dict:
    """Execute one full experiment run.

    Returns a result dict matching the schema in the plan.
    """
    print(f"\n{'='*60}")
    print(f"Run {run_id} (model: {model or 'default'})")
    print(f"{'='*60}")

    bootstrap_content = bootstrap_path.read_text(encoding="utf-8")
    run_dir = RUNS_DIR / run_id
    skills_dir = run_dir / "skills"

    result = {
        "run_id": run_id,
        "model": model or "default",
        "judge_model": judge_model or "default",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "max_round": 0,
        "total_steps": 0,
        "steps": [],
        "failure": None,
    }

    # The "current SC" — the level-1 skill used to start each round
    current_sc_content = bootstrap_content
    current_sc_path = str(bootstrap_path)
    step_index = 0

    for round_num in range(1, max_rounds + 1):
        target_ascent_level = round_num + 1
        print(f"\n--- Round {round_num} (ascend to level {target_ascent_level}, then descend) ---")

        # === ASCENT: current SC creates a skill of level (round+1) ===
        print(f"  Step {step_index + 1}: Ascent — {level_name(1)} → {level_name(target_ascent_level)}")

        step_dir = skills_dir / f"step-{step_index:02d}"
        exec_result = run_executor(current_sc_content, target_ascent_level, step_dir, model=model)

        step_record = {
            "step_index": step_index,
            "round": round_num,
            "direction": "ascent",
            "source_level": 1,
            "target_level": target_ascent_level,
            "source_path": current_sc_path,
            "output_path": exec_result["output_path"],
            "passed": False,
        }

        step_record["executor_usage"] = exec_result.get("token_usage")

        if not exec_result["success"]:
            step_record["judge_result"] = None
            step_record["expected_level"] = target_ascent_level
            result["steps"].append(step_record)
            result["failure"] = {
                "round": round_num,
                "step_index": step_index,
                "expected_level": target_ascent_level,
                "detected_level": -1,
                "reasoning": f"executor failed: {exec_result['error']}",
            }
            result["total_steps"] = step_index + 1
            print(f"    FAIL (executor): {exec_result['error']}")
            result["total_usage"] = sum_token_usage(result["steps"])
            return result

        # Judge the ascent output
        generated_content = Path(exec_result["output_path"]).read_text(encoding="utf-8")
        judge_result = run_judge_with_retries(generated_content, model=judge_model, run_dir=run_dir)

        step_record["judge_result"] = {
            "detected_level": judge_result["detected_level"],
            "reasoning": judge_result["reasoning"],
        }
        step_record["expected_level"] = target_ascent_level

        step_record["judge_usage"] = judge_result.get("token_usage")

        if judge_result.get("error"):
            result["steps"].append(step_record)
            result["failure"] = {
                "round": round_num,
                "step_index": step_index,
                "expected_level": target_ascent_level,
                "detected_level": -1,
                "reasoning": f"judge error: {judge_result['error']}",
            }
            result["total_steps"] = step_index + 1
            print(f"    FAIL (judge error): {judge_result['error']}")
            result["total_usage"] = sum_token_usage(result["steps"])
            return result

        passed = judge_result["detected_level"] == target_ascent_level
        step_record["passed"] = passed
        result["steps"].append(step_record)
        step_index += 1

        if not passed:
            result["failure"] = {
                "round": round_num,
                "step_index": step_index - 1,
                "expected_level": target_ascent_level,
                "detected_level": judge_result["detected_level"],
                "reasoning": judge_result["reasoning"],
            }
            result["total_steps"] = step_index
            print(f"    FAIL: expected level {target_ascent_level}, got {judge_result['detected_level']}")
            result["total_usage"] = sum_token_usage(result["steps"])
            return result

        print(f"    PASS (level {judge_result['detected_level']})")

        # === DESCENT: cascade from level (round+1) down to level 1 ===
        descent_source_content = generated_content
        descent_source_path = exec_result["output_path"]
        descent_source_level = target_ascent_level

        for descent_target in range(target_ascent_level - 1, 0, -1):
            print(f"  Step {step_index + 1}: Descent — {level_name(descent_source_level)} → {level_name(descent_target)}")

            step_dir = skills_dir / f"step-{step_index:02d}"
            exec_result = run_executor(descent_source_content, descent_target, step_dir, model=model)

            step_record = {
                "step_index": step_index,
                "round": round_num,
                "direction": "descent",
                "source_level": descent_source_level,
                "target_level": descent_target,
                "source_path": descent_source_path,
                "output_path": exec_result["output_path"],
                "passed": False,
            }

            step_record["executor_usage"] = exec_result.get("token_usage")

            if not exec_result["success"]:
                step_record["judge_result"] = None
                step_record["expected_level"] = descent_target
                result["steps"].append(step_record)
                result["failure"] = {
                    "round": round_num,
                    "step_index": step_index,
                    "expected_level": descent_target,
                    "detected_level": -1,
                    "reasoning": f"executor failed: {exec_result['error']}",
                }
                result["total_steps"] = step_index + 1
                print(f"    FAIL (executor): {exec_result['error']}")
                result["total_usage"] = sum_token_usage(result["steps"])
                return result

            generated_content = Path(exec_result["output_path"]).read_text(encoding="utf-8")
            judge_result = run_judge_with_retries(generated_content, model=judge_model, run_dir=run_dir)

            step_record["judge_result"] = {
                "detected_level": judge_result["detected_level"],
                "reasoning": judge_result["reasoning"],
            }
            step_record["expected_level"] = descent_target

            step_record["judge_usage"] = judge_result.get("token_usage")

            if judge_result.get("error"):
                result["steps"].append(step_record)
                result["failure"] = {
                    "round": round_num,
                    "step_index": step_index,
                    "expected_level": descent_target,
                    "detected_level": -1,
                    "reasoning": f"judge error: {judge_result['error']}",
                }
                result["total_steps"] = step_index + 1
                print(f"    FAIL (judge error): {judge_result['error']}")
                result["total_usage"] = sum_token_usage(result["steps"])
                return result

            passed = judge_result["detected_level"] == descent_target
            step_record["passed"] = passed
            result["steps"].append(step_record)
            step_index += 1

            if not passed:
                result["failure"] = {
                    "round": round_num,
                    "step_index": step_index - 1,
                    "expected_level": descent_target,
                    "detected_level": judge_result["detected_level"],
                    "reasoning": judge_result["reasoning"],
                }
                result["total_steps"] = step_index
                print(f"    FAIL: expected level {descent_target}, got {judge_result['detected_level']}")
                result["total_usage"] = sum_token_usage(result["steps"])
                return result

            print(f"    PASS (level {judge_result['detected_level']})")

            # Next descent step uses this output as source
            descent_source_content = generated_content
            descent_source_path = exec_result["output_path"]
            descent_source_level = descent_target

        # Round completed — the final descent output is the new SC for next round
        current_sc_content = descent_source_content
        current_sc_path = descent_source_path
        result["max_round"] = round_num

        print(f"  Round {round_num} complete!")

    result["total_steps"] = step_index
    print(f"\nRun complete. Reached round {result['max_round']}. Total steps: {step_index}.")
    result["total_usage"] = sum_token_usage(result["steps"])
    return result


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
