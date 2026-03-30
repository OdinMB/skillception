"""Verify that the Python and TypeScript type schemas stay in sync.

Performs a basic structural comparison of the field names in
result_schema.py TypedDicts against website/src/types.ts interfaces.
Exits with code 1 on mismatch.

Usage:
    python scripts/check_types_sync.py
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TS_TYPES = PROJECT_ROOT / "website" / "src" / "types.ts"


def parse_ts_interfaces(text: str) -> dict[str, set[str]]:
    """Extract interface names and their field names from TypeScript source."""
    interfaces: dict[str, set[str]] = {}
    current: str | None = None
    for line in text.splitlines():
        m = re.match(r"^export\s+interface\s+(\w+)", line)
        if m:
            current = m.group(1)
            interfaces[current] = set()
            continue
        if current and line.strip() == "}":
            current = None
            continue
        if current:
            fm = re.match(r"\s+(\w+)\s*[?:]", line)
            if fm:
                interfaces[current].add(fm.group(1))
    return interfaces


# Fields intentionally present only in Python (raw data, stripped on export)
PYTHON_ONLY_FIELDS: dict[str, set[str]] = {
    "Step": {"source_path", "output_path"},
}


def main() -> int:
    if not TS_TYPES.exists():
        print(f"ERROR: TypeScript types file not found: {TS_TYPES}", file=sys.stderr)
        return 1

    ts_interfaces = parse_ts_interfaces(TS_TYPES.read_text(encoding="utf-8"))
    errors: list[str] = []

    # Import Python schema
    from scripts.result_schema import (
        Failure,
        JudgeResult,
        RunResult,
        Step,
        TokenUsage,
    )

    py_types = {
        "TokenUsage": TokenUsage,
        "JudgeResult": JudgeResult,
        "Step": Step,
        "Failure": Failure,
        "RunResult": RunResult,
    }

    for name, td in py_types.items():
        if name not in ts_interfaces:
            errors.append(f"Interface {name} missing from TypeScript types")
            continue
        py_fields = set(td.__annotations__.keys())
        ts_fields = ts_interfaces[name]
        allowed_py_only = PYTHON_ONLY_FIELDS.get(name, set())
        py_extra = py_fields - ts_fields - allowed_py_only
        ts_extra = ts_fields - py_fields
        if py_extra:
            errors.append(f"{name}: fields in Python but not TS: {py_extra}")
        if ts_extra:
            errors.append(f"{name}: fields in TS but not Python: {ts_extra}")

    if errors:
        print("Schema sync errors:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    print("Schema sync check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
