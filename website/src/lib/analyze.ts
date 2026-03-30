import type { RunResult, GroupStats } from '../types'

/** Filter out runs that ended due to executor/judge errors. */
export function discardErrorRuns(results: RunResult[]): RunResult[] {
  return results.filter((r) => {
    if (!r.failure) return true
    // error is "call" | "parse" for technical failures, false for legitimate mismatches
    return r.failure.error === false || r.failure.error === undefined
  })
}

/**
 * Group runs by executor model, then by judge model within each executor.
 * Returns a Map keyed by executor model name, each value being a Map
 * keyed by judge model name.
 */
export function groupByExecutorAndJudge(
  results: RunResult[],
): Map<string, Map<string, RunResult[]>> {
  const map = new Map<string, Map<string, RunResult[]>>()
  for (const r of results) {
    const executor = r.model ?? 'opus'
    const judge = r.judge_model ?? r.model ?? 'opus'
    if (!map.has(executor)) map.set(executor, new Map())
    const judgeMap = map.get(executor)!
    if (!judgeMap.has(judge)) judgeMap.set(judge, [])
    judgeMap.get(judge)!.push(r)
  }
  return map
}

/** Compute aggregate statistics for a list of runs. */
export function computeStats(runs: RunResult[]): GroupStats {
  const n = runs.length

  const roundDistribution = new Map<number, number>()
  const maxRounds: number[] = []
  for (const r of runs) {
    maxRounds.push(r.max_round)
    roundDistribution.set(
      r.max_round,
      (roundDistribution.get(r.max_round) ?? 0) + 1,
    )
  }

  const validRounds = maxRounds.filter((r) => r >= 0)
  const sorted = [...validRounds].sort((a, b) => a - b)
  const maxRound = sorted.length ? sorted[sorted.length - 1] : 0
  const meanRound = sorted.length
    ? sorted.reduce((a, b) => a + b, 0) / sorted.length
    : 0
  const medianRound = sorted.length
    ? sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    : 0

  let ascentPass = 0,
    ascentTotal = 0,
    descentPass = 0,
    descentTotal = 0
  for (const r of runs) {
    for (const s of r.steps) {
      if (s.direction === 'ascent') {
        ascentTotal++
        if (s.passed) ascentPass++
      } else {
        descentTotal++
        if (s.passed) descentPass++
      }
    }
  }

  const failureCount = runs.filter((r) => r.failure !== null).length

  return {
    totalRuns: n,
    roundDistribution,
    maxRound,
    meanRound,
    medianRound,
    ascentPass,
    ascentTotal,
    descentPass,
    descentTotal,
    failureCount,
  }
}

/** Format a run's failure step as a human-readable string. */
export function formatFailureStep(run: RunResult): string {
  if (!run.failure) return '\u2014'
  const failedStep = run.steps.find((s) => s.step_index === run.failure!.step_index)
  if (!failedStep) return `round ${run.failure.round}`
  if (failedStep.direction === 'ascent') {
    return `ascent to level ${failedStep.target_level}`
  }
  return `descent ${failedStep.source_level} \u2192 ${failedStep.target_level}`
}

/**
 * Pick diverse failure reasoning samples from a set of runs.
 * Selects failures at different levels for variety.
 */
export function pickFailureQuotes(
  runs: RunResult[],
  count = 2,
): { run: RunResult; reasoning: string; description: string }[] {
  const failed = runs
    .filter((r) => r.failure !== null)
    .sort((a, b) => a.failure!.expected_level - b.failure!.expected_level)

  if (failed.length === 0) return []

  // Pick evenly spaced samples for level diversity
  const step = Math.max(1, Math.floor(failed.length / count))
  const picks: { run: RunResult; reasoning: string; description: string }[] = []
  for (let i = 0; i < failed.length && picks.length < count; i += step) {
    const r = failed[i]
    picks.push({
      run: r,
      reasoning: r.failure!.reasoning,
      description: `Run ${r.run_id.slice(0, 8)}, ${formatFailureStep(r)} (expected level ${r.failure!.expected_level}, detected ${r.failure!.detected_level === null ? (typeof r.failure!.error === 'string' ? r.failure!.error + ' error' : 'error') : r.failure!.detected_level})`,
    })
  }
  return picks
}
