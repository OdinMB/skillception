"""Export experiment results as JSON for the website.

Reads result.json files from runs/ and writes a cleaned array
suitable for the React frontend.

Usage:
    python scripts/export_results.py
    python scripts/export_results.py --runs-dir path/to/runs --output website/public/results.json
"""

import argparse
import json
import sys
from pathlib import Path


def load_and_clean(runs_dir: Path) -> list[dict]:
    """Load all result.json files, stripping local file paths."""
    results = []
    for f in sorted(runs_dir.glob("*/result.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"  Warning: skipping {f.parent.name}: {e}", file=sys.stderr)
            continue

        # Strip file paths from steps (contain local machine info)
        for step in data.get("steps", []):
            step.pop("source_path", None)
            step.pop("output_path", None)

        results.append(data)
    return results


def main():
    parser = argparse.ArgumentParser(description="Export results for website")
    parser.add_argument("--runs-dir", type=Path,
                        default=Path(__file__).resolve().parent.parent / "runs",
                        help="Path to runs directory")
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).resolve().parent.parent / "website" / "public" / "results.json",
                        help="Output JSON path")
    args = parser.parse_args()

    if not args.runs_dir.exists():
        print(f"ERROR: Runs directory not found: {args.runs_dir}", file=sys.stderr)
        sys.exit(1)

    results = load_and_clean(args.runs_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"Exported {len(results)} runs to {args.output}")


if __name__ == "__main__":
    main()
