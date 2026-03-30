# Per-Step Token Consumption by Round

- **Date**: 2026-03-30
- **Status**: done
- **Type**: feature

## Problem
The current token charts show total tokens *per round*, but higher rounds have more steps (round R has R+1 steps: 1 ascent + R descent steps). Users can't see whether cost growth comes from harder steps or just more of them.

## Approach
Added `computeMeanStepTokens` to compute mean total tokens per step (constant across rounds), displayed as a summary table (Table 2). Explanatory text uses haiku as a worked example showing quadratic step-count scaling at rounds 1, 5, and 9. Replaced the previous per-step chart approach after finding that per-step cost is essentially constant.

## Changes

| File | Change |
|------|--------|
| `website/src/lib/analyze.ts` | Replaced `computeTokensByStep` with `computeMeanStepTokens` (mean total tokens/step) and `totalStepsThroughRound` (step count formula) |
| `website/src/lib/analyze.test.ts` | Tests for both new functions |
| `website/src/App.tsx` | Replaced per-step charts with Table 2 (tokens/step by model×role) and explanatory paragraph with haiku worked example |
| `website/src/types.ts` | Removed unused `StepTokenStats` interface |
