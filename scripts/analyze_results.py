"""Analyze results from meta-skill experiment runs.

Reads result.json files from runs/ subdirectories and prints aggregate statistics.

Usage:
    python scripts/analyze_results.py
    python scripts/analyze_results.py --runs-dir path/to/runs
"""

import argparse
import statistics
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.result_schema import load_results


def analyze_group(results: list[dict], label: str):
    """Print aggregate statistics for a group of results."""
    n = len(results)
    print(f"\n{'='*60}")
    print(f"META-SKILL EXPERIMENT RESULTS — {label} ({n} runs)")
    print(f"{'='*60}")

    if n == 0:
        print("No results found.")
        return

    # Max round distribution
    max_rounds = [r.get("max_round", 0) for r in results]
    round_counts = Counter(max_rounds)

    print(f"\n## Max Round Reached\n")
    for level in sorted(round_counts.keys()):
        count = round_counts[level]
        bar = "#" * count
        pct = count / n * 100
        row_label = f"Round {level}" if level >= 1 else "None (failed round 1)"
        print(f"  {row_label:25s} | {bar:30s} {count:3d} ({pct:.0f}%)")

    # Failure analysis
    failures = [r.get("failure") for r in results if r.get("failure") is not None]
    successes = n - len(failures)

    print(f"\n## Summary\n")
    print(f"  Total runs:          {n}")
    print(f"  Completed all rounds: {successes}")
    print(f"  Failed:              {len(failures)}")

    if max_rounds:
        # Include max_round == 0 (failed during round 1) in statistics
        valid_rounds = [r for r in max_rounds if r >= 0]
        if valid_rounds:
            print(f"  Mean max round:      {sum(valid_rounds) / len(valid_rounds):.1f}")
            print(f"  Median max round:    {statistics.median(valid_rounds)}")
            print(f"  Max max round:       {max(valid_rounds)}")

    if not failures:
        print("\n  No failures to analyze.")
        return

    # Failure round distribution
    fail_rounds = Counter(f["round"] for f in failures)
    print(f"\n## Failure Distribution by Round\n")
    for round_num in sorted(fail_rounds.keys()):
        count = fail_rounds[round_num]
        bar = "#" * count
        print(f"  Round {round_num:2d} | {bar:30s} {count:3d}")

    # Failure by direction
    all_steps = []
    for r in results:
        for s in r["steps"]:
            all_steps.append(s)

    direction_pass = Counter()
    direction_fail = Counter()
    for s in all_steps:
        if s["passed"]:
            direction_pass[s["direction"]] += 1
        else:
            direction_fail[s["direction"]] += 1

    print(f"\n## Pass/Fail by Direction\n")
    for d in ["ascent", "descent"]:
        p = direction_pass.get(d, 0)
        f = direction_fail.get(d, 0)
        total = p + f
        if total > 0:
            print(f"  {d:10s}: {p}/{total} passed ({p/total*100:.0f}%)")

    # Failure by expected level
    fail_levels = Counter(f.get("expected_level", -1) for f in failures)
    print(f"\n## Failures by Expected Target Level\n")
    for level in sorted(fail_levels.keys()):
        count = fail_levels[level]
        bar = "#" * count
        print(f"  Level {level:2d} | {bar:30s} {count:3d}")

    # Level mismatch patterns
    mismatches = [(f["expected_level"], f["detected_level"]) for f in failures
                  if f["detected_level"] != -1]
    if mismatches:
        mismatch_counts = Counter(mismatches)
        print(f"\n## Level Mismatch Patterns (expected → detected)\n")
        for (exp, det), count in mismatch_counts.most_common(10):
            print(f"  Level {exp} → Level {det}: {count} times")

    # Failure modes
    error_failures = [f for f in failures if f["detected_level"] == -1]
    mismatch_failures = [f for f in failures if f["detected_level"] != -1]
    print(f"\n## Failure Modes\n")
    print(f"  Level mismatch:  {len(mismatch_failures)}")
    print(f"  Executor/judge error: {len(error_failures)}")

    # Step-level success rates
    step_stats: dict[int, dict] = {}
    for s in all_steps:
        idx = s["step_index"]
        if idx not in step_stats:
            step_stats[idx] = {"passed": 0, "failed": 0}
        if s["passed"]:
            step_stats[idx]["passed"] += 1
        else:
            step_stats[idx]["failed"] += 1

    if step_stats:
        print(f"\n## Step-Level Success Rates\n")
        for idx in sorted(step_stats.keys()):
            s = step_stats[idx]
            total = s["passed"] + s["failed"]
            rate = s["passed"] / total * 100
            bar = "#" * int(rate / 5)
            print(f"  Step {idx + 1:2d} | {bar:20s} {rate:5.1f}% ({s['passed']}/{total})")


def main():
    parser = argparse.ArgumentParser(description="Analyze meta-skill experiment results")
    parser.add_argument("--runs-dir", type=Path,
                        default=Path(__file__).resolve().parent.parent / "runs",
                        help="Path to runs directory")
    args = parser.parse_args()

    if not args.runs_dir.exists():
        print(f"ERROR: Runs directory not found: {args.runs_dir}", file=sys.stderr)
        sys.exit(1)

    results = load_results(args.runs_dir)
    # Canonical definition: an "error run" has failure.detected_level == -1,
    # meaning the judge or executor crashed rather than producing a level
    # mismatch. This predicate is mirrored in website/src/lib/analyze.ts
    # (discardErrorRuns) — keep them in sync.
    error_runs = [r for r in results
                  if r.get("failure") and r["failure"].get("detected_level") == -1]
    clean_results = [r for r in results
                     if not r.get("failure") or r["failure"].get("detected_level") != -1]
    if error_runs:
        print(f"Discarded {len(error_runs)} run(s) that ended due to executor/judge errors.")
    analyze(clean_results)


def analyze(results: list[dict]):
    """Group results by executor model and judge model, then analyze each group."""
    combos = sorted(set(
        (r.get("model", "opus"), r.get("judge_model", r.get("model", "opus")))
        for r in results
    ))

    if len(combos) <= 1:
        executor, judge = combos[0] if combos else ("opus", "opus")
        label = executor if executor == judge else f"executor={executor}, judge={judge}"
        analyze_group(results, label)
    else:
        for executor, judge in combos:
            group = [r for r in results
                     if r.get("model", "opus") == executor
                     and r.get("judge_model", r.get("model", "opus")) == judge]
            label = f"executor={executor}, judge={judge}"
            analyze_group(group, label)


if __name__ == "__main__":
    main()
