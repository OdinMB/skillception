# Token Usage Overview

- **Date**: 2026-03-30
- **Status**: draft
- **Type**: feature

## Problem
The website shows round distributions and failure analysis but no insight into how many tokens each model consumes. Users want to see token usage per round to understand the computational cost of reaching deeper meta-levels.

## Approach
Add a new section (Section 2 "Resource Consumption", shifting existing sections down) with a stacked bar chart showing token usage per round, broken down by token category. Compute the data in `analyze.ts` and visualize it with a new `TokenChart` component.

**Data model**: For each round, sum token usage across all steps in that round per run, then average across runs that reached that round. Track all four token fields (`inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`) separately for both executor and judge.

**Chart design**: A horizontal stacked bar chart per round, with segments colored by token category. One chart per model variant (same pattern as the round distribution charts). The existing `BarChart` component only supports single-value bars, so a new `TokenChart` component handles stacked segments. Uses the existing color palette: red for output, blue for input, green for cache read, amber for cache creation.

**Website display**: Show executor token usage prominently (per original requirement). Judge tokens are computed and available but shown separately/below to keep the focus on executor cost.

## Changes

| File | Change |
|------|--------|
| `website/src/lib/analyze.ts` | Add `computeTokensByRound(runs)` — returns `Map<number, RoundTokenStats>` where `RoundTokenStats` has `executor` and `judge` objects, each with mean values for all four token fields plus `runCount`. |
| `website/src/types.ts` | Add `RoundTokenStats` interface (below the generated types section, alongside `GroupStats`). |
| `website/src/components/TokenChart.tsx` | New stacked horizontal bar chart component. Props: array of `{ label, segments: { value, color, name }[] }`. Renders stacked bars with a legend. Follows `BarChart` patterns (CSS classes, sizing). |
| `website/src/index.css` | Add CSS for `.token-chart` stacked bar styles (track, segments, legend). |
| `website/src/App.tsx` | Add Section 2 "Resource Consumption" showing `TokenChart` per model variant for executor usage, with a smaller judge chart below. Shift existing section numbers (2→3, 3→4, 4→5). |
| `website/src/lib/analyze.test.ts` | Add tests for `computeTokensByRound`: correct averaging, null usage handling, multi-round runs, executor vs judge separation. |

## Tests
- `computeTokensByRound` with single run, single round — returns exact values
- `computeTokensByRound` with multiple runs — correctly averages
- `computeTokensByRound` with null `executor_usage` / `judge_usage` — skips nulls, adjusts count
- `computeTokensByRound` with multi-round run — separate entries per round
- `TokenChart` component render — snapshot or basic DOM assertion (optional, low priority)

## Out of Scope
- Per-step granularity (aggregate by round only)
- Cost estimation in dollars
- Cumulative/running-total view
