"""Check that website/src/types.ts stays in sync with result_schema.py.

Reads the generated block between marker comments in types.ts and
compares it against what generate_types_ts() would produce. Exits 0
if they match, 1 if they differ.

Usage:
    python scripts/check_types_sync.py
"""

import sys
from pathlib import Path

# Allow importing when run directly (python scripts/check_types_sync.py)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.result_schema import generate_types_ts  # noqa: E402

TYPES_TS = Path(__file__).resolve().parent.parent / "website" / "src" / "types.ts"

BEGIN_MARKER = "// --- BEGIN GENERATED TYPES (do not edit manually — see scripts/result_schema.py) ---"
END_MARKER = "// --- END GENERATED TYPES ---"


def extract_generated_block(content: str) -> str | None:
    """Extract text between the marker comments, exclusive of markers."""
    begin_idx = content.find(BEGIN_MARKER)
    end_idx = content.find(END_MARKER)
    if begin_idx == -1 or end_idx == -1:
        return None
    start = begin_idx + len(BEGIN_MARKER)
    return content[start:end_idx].strip()


def main() -> int:
    if not TYPES_TS.exists():
        print(f"ERROR: {TYPES_TS} not found", file=sys.stderr)
        return 1

    ts_content = TYPES_TS.read_text(encoding="utf-8")
    existing = extract_generated_block(ts_content)

    if existing is None:
        print("ERROR: marker comments not found in types.ts", file=sys.stderr)
        return 1

    expected = generate_types_ts().strip()

    if existing == expected:
        print("OK: types.ts is in sync with result_schema.py")
        return 0

    print("MISMATCH: types.ts generated block differs from result_schema.py", file=sys.stderr)
    print("\nExpected:\n" + expected, file=sys.stderr)
    print("\nActual:\n" + existing, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
