import type { RunResult, GroupStats, RoundTokenStats, AgentTokenStats, TokenUsage, Failure } from '../types'

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

const TOKEN_FIELDS: (keyof TokenUsage)[] = [
  'inputTokens',
  'outputTokens',
  'cacheReadInputTokens',
  'cacheCreationInputTokens',
]

function emptyAgentStats(): AgentTokenStats {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    runCount: 0,
  }
}

/**
 * Compute mean token usage per completed round across a set of runs.
 * Only includes a run's data for round R if every step in that round passed
 * (i.e., the run actually completed round R). Steps with null usage are
 * excluded from the average without disqualifying the round.
 */
export function computeTokensByRound(
  runs: RunResult[],
): Map<number, RoundTokenStats> {
  const roundSums = new Map<
    number,
    { executor: { sums: number[]; count: number }; judge: { sums: number[]; count: number } }
  >()

  for (const run of runs) {
    // Group steps by round
    const stepsByRound = new Map<number, typeof run.steps>()
    for (const step of run.steps) {
      if (!stepsByRound.has(step.round)) stepsByRound.set(step.round, [])
      stepsByRound.get(step.round)!.push(step)
    }

    for (const [round, steps] of stepsByRound) {
      // Only include rounds where every step passed
      if (!steps.every((s) => s.passed)) continue

      if (!roundSums.has(round)) {
        roundSums.set(round, {
          executor: { sums: TOKEN_FIELDS.map(() => 0), count: 0 },
          judge: { sums: TOKEN_FIELDS.map(() => 0), count: 0 },
        })
      }
      const acc = roundSums.get(round)!

      // Sum executor usage across steps in this round for this run
      let hasExecutor = false
      const execTotals = TOKEN_FIELDS.map(() => 0)
      for (const step of steps) {
        if (step.executor_usage) {
          hasExecutor = true
          for (let i = 0; i < TOKEN_FIELDS.length; i++) {
            execTotals[i] += step.executor_usage[TOKEN_FIELDS[i]]
          }
        }
      }
      if (hasExecutor) {
        acc.executor.count++
        for (let i = 0; i < TOKEN_FIELDS.length; i++) acc.executor.sums[i] += execTotals[i]
      }

      // Sum judge usage
      let hasJudge = false
      const judgeTotals = TOKEN_FIELDS.map(() => 0)
      for (const step of steps) {
        if (step.judge_usage) {
          hasJudge = true
          for (let i = 0; i < TOKEN_FIELDS.length; i++) {
            judgeTotals[i] += step.judge_usage[TOKEN_FIELDS[i]]
          }
        }
      }
      if (hasJudge) {
        acc.judge.count++
        for (let i = 0; i < TOKEN_FIELDS.length; i++) acc.judge.sums[i] += judgeTotals[i]
      }
    }
  }

  // Average
  const result = new Map<number, RoundTokenStats>()
  for (const [round, acc] of roundSums) {
    const executor = emptyAgentStats()
    if (acc.executor.count > 0) {
      executor.runCount = acc.executor.count
      for (let i = 0; i < TOKEN_FIELDS.length; i++) {
        executor[TOKEN_FIELDS[i]] = Math.round(acc.executor.sums[i] / acc.executor.count)
      }
    }

    const judge = emptyAgentStats()
    if (acc.judge.count > 0) {
      judge.runCount = acc.judge.count
      for (let i = 0; i < TOKEN_FIELDS.length; i++) {
        judge[TOKEN_FIELDS[i]] = Math.round(acc.judge.sums[i] / acc.judge.count)
      }
    }

    result.set(round, { executor, judge })
  }
  return result
}

function sumUsage(usage: TokenUsage): number {
  return usage.inputTokens + usage.outputTokens +
    usage.cacheReadInputTokens + usage.cacheCreationInputTokens
}

/**
 * Compute mean total tokens per step for executor and judge across runs.
 * Only counts steps from rounds where every step passed.
 */
export function computeMeanStepTokens(
  runs: RunResult[],
): { executor: number; judge: number; stepCount: number } {
  let execSum = 0, execCount = 0
  let judgeSum = 0, judgeCount = 0

  for (const run of runs) {
    const stepsByRound = new Map<number, typeof run.steps>()
    for (const step of run.steps) {
      if (!stepsByRound.has(step.round)) stepsByRound.set(step.round, [])
      stepsByRound.get(step.round)!.push(step)
    }

    for (const [, steps] of stepsByRound) {
      if (!steps.every((s) => s.passed)) continue
      for (const step of steps) {
        if (step.executor_usage) {
          execSum += sumUsage(step.executor_usage)
          execCount++
        }
        if (step.judge_usage) {
          judgeSum += sumUsage(step.judge_usage)
          judgeCount++
        }
      }
    }
  }

  return {
    executor: execCount > 0 ? Math.round(execSum / execCount) : 0,
    judge: judgeCount > 0 ? Math.round(judgeSum / judgeCount) : 0,
    stepCount: Math.max(execCount, judgeCount),
  }
}

/** Build bar chart data for round distribution within a global range. */
export function buildRoundBars(
  stats: GroupStats,
  globalMinRound: number,
  globalMaxRound: number,
): { label: string; value: number }[] {
  const bars = []
  for (let r = globalMinRound; r <= globalMaxRound; r++) {
    const count = stats.roundDistribution.get(r) ?? 0
    bars.push({ label: `Round ${r}`, value: count })
  }
  return bars
}

/**
 * Build grouped round distribution data for all variants.
 * Returns an array of objects with round number and percentage for each variant.
 */
export function buildGroupedRoundData(
  variants: { label: string; stats: GroupStats }[],
): { round: number; [label: string]: number }[] {
  const rows: { round: number; [label: string]: number }[] = []
  for (let r = 1; r <= 9; r++) {
    const row: { round: number; [label: string]: number } = { round: r }
    for (const v of variants) {
      const count = v.stats.roundDistribution.get(r) ?? 0
      const pct = v.stats.totalRuns > 0
        ? +((count / v.stats.totalRuns) * 100).toFixed(1)
        : 0
      row[v.label] = pct
    }
    rows.push(row)
  }
  return rows
}

/** Format a failure percentage from pass count and total. */
export function failPct(pass: number, total: number): string {
  if (total === 0) return '\u2014'
  const failRate = ((total - pass) / total) * 100
  return failRate === 0 ? '0%' : `${failRate.toFixed(1)}%`
}

/** Build a display label for a model/judge variant. */
export function variantLabel(
  modelName: string,
  modelLabel: string,
  judgeName: string,
  judgeLabel: string,
): string {
  if (modelName === judgeName) {
    return `${modelLabel} (self-judged)`
  }
  return `${modelLabel} (judged by ${judgeLabel})`
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

/** Format a failure's detected level for display in quote attributions. */
export function formatDetectedLevel(failure: Failure): string {
  if (failure.detected_level === null) {
    return typeof failure.error === 'string' ? `${failure.error} error` : 'error'
  }
  return `expected level ${failure.expected_level}, detected ${failure.detected_level}`
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
      description: `Run ${r.run_id.slice(0, 8)}, ${formatFailureStep(r)} (${formatDetectedLevel(r.failure!)})`,
    })
  }
  return picks
}
