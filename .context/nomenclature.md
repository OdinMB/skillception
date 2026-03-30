# Nomenclature

Canonical definitions for levels, rounds, and naming in the Skillception experiment.

## Levels

The **level** equals the number of "Creator"s in the name:

| Level | Name | Slug | What it creates |
|-------|------|------|-----------------|
| 1 | Skill Creator | `skill-creator` | An arbitrary skill |
| 2 | Skill Creator Creator | `skill-creator-creator` | A level-1 skill |
| 3 | Skill Creator Creator Creator | `skill-creator-creator-creator` | A level-2 skill |
| N | Skill + "Creator" × N | `skill` + `-creator` × N | A level-(N-1) skill |

The bootstrap skill (the real Skill Creator plugin) is level 1.

## Rounds

Rounds are **1-indexed**. Each round adds one level:

| Round | Ascent target | Descent to | Peak level |
|-------|--------------|------------|------------|
| 1 | 2 | 1 | 2 |
| 2 | 3 | 1 | 3 |
| 9 | 10 | 1 | 10 |

Runs are capped at **9 rounds**. Round 9 generates a level-10 skill creator (10 "Creator"s).

## Sentinel values

- `detected_level: -1` — the judge found the skill incoherent (no determinable level).
- `max_round: 0` — no rounds completed (failed during round 1).

## In code

- `level_name(n)` returns `"Skill" + " Creator" * n`
- `level_slug(n)` returns `"skill" + "-creator" * n`
- `level_name(1)` → `"Skill Creator"`, `level_name(3)` → `"Skill Creator Creator Creator"`
