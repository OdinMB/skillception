# Simplify Results Website

- **Date**: 2026-03-30
- **Status**: draft
- **Type**: refactor

## Problem

The website currently shows all model/judge combos with generic tabs and detailed step traces. It should instead focus on the three models (opus, sonnet, haiku) judged by opus, with a clearer narrative structure: round distributions, failure analysis with sample judge quotes, and a compact run overview at the bottom.

## Approach

Rewrite `App.tsx` with a new page structure. Simplify `analyze.ts` to filter for opus-judged runs only and group by executor model. Replace the generic RunAccordion (which showed full step traces) with a simpler expandable run table. Delete unused components (StepTrace, SummaryTable). Make logo and title much larger in CSS.

The new page sections:
1. **Header** — larger logo (160px) and title (42px)
2. **Abstract** — computed from all three models' data
3. **Section 1: Round Distributions** — side-by-side bar charts for opus/sonnet/haiku
4. **Section 2: Failure Analysis** — ascent/descent failure % per model, sample judge quotes for sonnet and haiku failures (opus completes to level 10)
5. **Section 3: Run Overview** — collapsed section with opus/sonnet/haiku tabs, each showing a table of runs with expandable judge justification
6. **References & Footnotes**

## Changes

| File | Change |
|------|--------|
| `website/src/lib/analyze.ts` | Replace `groupByModels` with `filterOpusJudged` that returns `Map<string, RunResult[]>` keyed by executor model. Remove `pickJudgeQuotes`, `allSteps`, `levelName`, `fullLevelName` (unused). Add `formatFailureStep(run)` helper that returns "ascent level 5" or "descent 5 → 4" strings. Add `pickFailureQuotes(runs, count)` that selects diverse failure reasoning samples. |
| `website/src/types.ts` | Remove `ModelGroup` interface (no longer needed). Keep `GroupStats` but simplify — remove the `group` field. |
| `website/src/App.tsx` | Complete rewrite. New structure: load data → filter opus-judged → compute stats per model → render new section layout. No more generic tabs/groups. Models hardcoded as `['opus', 'sonnet', 'haiku']` in display order. |
| `website/src/components/JournalHeader.tsx` | Remove props. Make it static — no dynamic run counts in header (those go in abstract). |
| `website/src/components/Abstract.tsx` | New props: stats for all three models. Summarize key findings. |
| `website/src/components/BarChart.tsx` | No change needed. |
| `website/src/components/RunAccordion.tsx` | Rewrite to simpler run table with expandable rows. Props: `runs: RunResult[]`. Each row: run ID, peak level, failure step description. Expanding shows judge justification. No step traces. |
| `website/src/components/StepTrace.tsx` | Delete (not needed). |
| `website/src/components/SummaryTable.tsx` | Delete (replaced by run overview). |
| `website/src/components/JudgeQuote.tsx` | Keep as-is — used in failure analysis section. |
| `website/src/index.css` | Increase `.seal` to 160px. Increase `.article-title` to 42px. Remove `.step-trace` styles (deleted component). Remove `.model-tabs` / `.model-tab` styles (tabs now inline in run overview). Add tab styles scoped to run overview section. |

## Tests

No test infrastructure exists yet. Verify with `npm run website:build` (typecheck + vite build) and `npm run website:lint`.

## Out of Scope

- Adding new data or re-running experiments
- Responsive/mobile design improvements
- Deployment or hosting setup
- The export script (unchanged)
