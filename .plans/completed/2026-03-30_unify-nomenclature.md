# Unify Nomenclature (1-Indexed Levels and Rounds)

- **Date**: 2026-03-30
- **Status**: draft
- **Type**: refactor

## Problem

The project uses 0-indexed levels (Skill Creator = level 0) and 0-indexed rounds. The user wants 1-indexed levels where the number of "creator"s equals the level (skill-creator = level 1, skill-creator-creator = level 2), 1-indexed rounds (round 1 goes from level 1 to level 2), and a cap of 9 rounds (round 9 generates level 10).

## Approach

Shift all level references from 0-indexed to 1-indexed, shift rounds from 0-indexed to 1-indexed, and cap at 9 rounds. The bootstrap skill-creator starts at level 1. Create a `.context/nomenclature.md` file and add a note to `CLAUDE.md`. Update all agents, scripts, website code, and the README.

The data schema for `result.json` changes: all `*_level` fields shift by +1, `round` fields shift by +1, and `max_round` represents the 1-indexed last completed round.

**Backwards compatibility**: Existing `runs/` data will become inconsistent with new code. Since `runs/` is gitignored and this is an experiment harness (not a production system), we accept this. A note in the plan's out-of-scope section.

## Changes

| File | Change |
|------|--------|
| `.context/nomenclature.md` | **New file.** Defines the canonical nomenclature: level = count of "creator"s, rounds are 1-indexed, 9-round cap. |
| `CLAUDE.md` | Add a bullet under "What this repo does" referencing `.context/nomenclature.md` for level/round definitions. Update the description to say "ascending meta-level" without specific level numbers. |
| `README.md` | Update abstract: "Skill Creator (level 1) creates skills. Skill Creator Creator (level 2) creates Skill Creators." Update all level/round references throughout. Shift the results table. Update footnote 4. |
| `agents/executor.md` | Update Meta-Level Taxonomy: Level 1 = SC (1 "creator"), Level 2 = SCC (2 "creator"s), Level N = N "creator"s. Update examples. Level N creates level-(N-1) skills. Level 1 creates arbitrary skills. |
| `agents/judge.md` | Same taxonomy shift. Level 1 = creates arbitrary skills. Level 2 = creates skill creators. Shift all examples. Incoherent = detected_level 0 (or keep -1 as a sentinel — -1 is better since 0 is now "not a skill creator at all"). |
| `scripts/run_experiment.py` | `level_name(n)`: Level N = "Skill" + " Creator" * N (was N+1). `level_slug(n)`: "skill" + "-creator" * N. Bootstrap = level 1. Rounds loop `for round_num in range(1, max_rounds + 1)`. Ascent target = round_num + 1. Descent goes back to level 1 (not 0). Default `--max-rounds` = 9. `current_sc_content` starts at level 1. Update all print statements and record fields to use 1-indexed values. |
| `scripts/analyze_results.py` | Update `Round {level}` display labels. The "None (failed round 0)" case becomes "None (failed round 1)". No logic changes needed since it reads from data. |
| `scripts/export_results.py` | No changes needed — it's a pass-through. |
| `website/src/types.ts` | No schema changes — the field names are generic (`target_level`, `round`, etc.). The values just shift. |
| `website/src/components/Abstract.tsx` | "Skill Creator (level 1) creates skills. Skill Creator Creator (level 2) creates Skill Creators." Fix `peakLevel` calc: was `overallMax + 2`, now `overallMax + 1` (since max_round N means peak level = N+1 with 1-indexed rounds). |
| `website/src/App.tsx` | `buildRoundBars`: label changes from `Round ${r + 1}` to `Round ${r}` (data is already 1-indexed). Figure caption update. |
| `website/src/lib/analyze.ts` | `formatFailureStep`: update level display text. No logic changes. |
| `website/src/components/RunAccordion.tsx` | No changes — displays data values directly. |

## Key Details

### `level_name` / `level_slug` mapping (the core shift)

| Level | Name | Slug | "Creator" count |
|-------|------|------|-----------------|
| 1 | Skill Creator | skill-creator | 1 |
| 2 | Skill Creator Creator | skill-creator-creator | 2 |
| 3 | Skill Creator Creator Creator | skill-creator-creator-creator | 3 |
| N | Skill Creator^N | skill-creator^N | N |

### Round flow (9-round cap)

| Round | Ascent target | Descent to | Peak level |
|-------|--------------|------------|------------|
| 1 | 2 | 1 | 2 |
| 2 | 3 | 1 | 3 |
| 9 | 10 | 1 | 10 |

### `run_experiment.py` specific changes

- `level_name(n)` → `"Skill" + " Creator" * n` (remove the +1)
- `level_slug(n)` → `"skill" + "-creator" * n` (remove the +1)
- Bootstrap is level 1, `current_sc_level = 1`
- `for round_num in range(1, max_rounds + 1)` instead of `range(max_rounds)`
- Ascent target = `round_num + 1` (round 1 → level 2, round 9 → level 10)
- Descent goes from peak down to level 1 (was 0): `range(target - 1, 0, -1)` → inclusive of 1
- Default `--max-rounds` = 9
- All `source_level`, `target_level`, `expected_level` in step records naturally become 1-indexed since they derive from the loop variables

### Judge incoherent sentinel

Keep `-1` for incoherent skills. Level 0 has no defined meaning in the new scheme (it would be "Skill" with zero "creator"s — nonsensical). The judge instructions should say: if incoherent, return `detected_level: -1`. Same as before.

## Tests

- `npm run website:typecheck` — ensure no TS errors after website changes
- `npm run website:build` — production build succeeds
- Manual review of the README for consistent level/round numbering
- Verify `level_name(1) == "Skill Creator"`, `level_name(3) == "Skill Creator Creator Creator"` mentally

## Out of Scope

- **Migrating existing `runs/` data** — old result.json files use 0-indexed levels/rounds. They're gitignored and ephemeral. New runs will use the new scheme.
- **Migrating `website/public/results.json`** — needs re-export after new runs. The committed version (if any) will be stale until then.
- **Changing the experiment structure** (ascent/descent pattern) — only nomenclature changes.
