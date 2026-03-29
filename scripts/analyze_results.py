"""Analyze results from meta-skill experiment runs.

Reads all JSON files in results/ and prints aggregate statistics.

Usage:
    python scripts/analyze_results.py
    python scripts/analyze_results.py --results-dir path/to/results
"""

import argparse
import json
import statistics
import sys
from collections import Counter
from pathlib import Path


def load_results(results_dir: Path) -> list[dict]:
    """Load all result JSON files from the directory."""
    results = []
    for f in sorted(results_dir.glob("*.json")):
        if f.name == "analysis.json":
            continue
        try:
            results.append(json.loads(f.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError) as e:
            print(f"  Warning: skipping {f.name}: {e}", file=sys.stderr)
    return results


def analyze(results: list[dict]):
    """Print aggregate statistics."""
    n = len(results)
    print(f"\n{'='*60}")
    print(f"META-SKILL EXPERIMENT RESULTS ({n} runs)")
    print(f"{'='*60}")

    if n == 0:
        print("No results found.")
        return

    # Max round distribution
    max_rounds = [r["max_round"] for r in results]
    round_counts = Counter(max_rounds)

    print(f"\n## Max Round Reached\n")
    for level in sorted(round_counts.keys()):
        count = round_counts[level]
        bar = "#" * count
        pct = count / n * 100
        label = f"Round {level}" if level >= 0 else "None (failed round 0)"
        print(f"  {label:25s} | {bar:30s} {count:3d} ({pct:.0f}%)")

    # Failure analysis
    failures = [r["failure"] for r in results if r["failure"] is not None]
    successes = n - len(failures)

    print(f"\n## Summary\n")
    print(f"  Total runs:          {n}")
    print(f"  Completed all rounds: {successes}")
    print(f"  Failed:              {len(failures)}")

    if max_rounds:
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
    fail_levels = Counter(f["expected_level"] for f in failures)
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
        for idx in sorted(step_stats.keys())[:20]:
            s = step_stats[idx]
            total = s["passed"] + s["failed"]
            rate = s["passed"] / total * 100
            bar = "#" * int(rate / 5)
            print(f"  Step {idx:2d} | {bar:20s} {rate:5.1f}% ({s['passed']}/{total})")


def main():
    parser = argparse.ArgumentParser(description="Analyze meta-skill experiment results")
    parser.add_argument("--results-dir", type=Path,
                        default=Path(__file__).resolve().parent.parent / "results",
                        help="Path to results directory")
    args = parser.parse_args()

    if not args.results_dir.exists():
        print(f"ERROR: Results directory not found: {args.results_dir}", file=sys.stderr)
        sys.exit(1)

    results = load_results(args.results_dir)
    analyze(results)


if __name__ == "__main__":
    main()
