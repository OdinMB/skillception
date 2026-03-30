import type { RunResult, ModelGroup, GroupStats, Step } from '../types'

/** Filter out runs that ended due to executor/judge errors (detected_level === -1). */
export function discardErrorRuns(results: RunResult[]): {
  clean: RunResult[]
  discarded: number
} {
  const clean = results.filter(
    (r) => !r.failure || r.failure.detected_level !== -1,
  )
  return { clean, discarded: results.length - clean.length }
}

/** Group results by executor model + judge model combination. */
export function groupByModels(results: RunResult[]): ModelGroup[] {
  const map = new Map<string, RunResult[]>()

  for (const r of results) {
    const executor = r.model ?? 'opus'
    const judge = r.judge_model ?? r.model ?? 'opus'
    const key = `${executor}|${judge}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }

  return Array.from(map.entries())
    .map(([key, runs]) => {
      const [executor, judge] = key.split('|')
      const label =
        executor === judge
          ? executor
          : `executor=${executor}, judge=${judge}`
      return { executor, judge, label, runs }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Compute aggregate statistics for a group of runs. */
export function computeStats(group: ModelGroup): GroupStats {
  const runs = group.runs
  const n = runs.length

  // Max round distribution
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

  // Direction pass rates
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
    group,
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

/** Get all steps across all runs in a group. */
export function allSteps(runs: RunResult[]): Step[] {
  return runs.flatMap((r) => r.steps)
}

/** Format a meta-level as SC^N notation. */
export function levelName(level: number): string {
  if (level === 0) return 'SC'
  if (level === 1) return 'SCC'
  if (level === 2) return 'SCCC'
  return `SC\u{207F}` // fallback — components render superscripts directly
}

/** Build the full "Skill Creator Creator..." name for a level. */
export function fullLevelName(level: number): string {
  return 'Skill ' + 'Creator '.repeat(level + 1).trim()
}

/** Pick interesting judge quotes from a run's steps. */
export function pickJudgeQuotes(
  run: RunResult,
  maxQuotes = 3,
): { step: Step; category: string }[] {
  const quotes: { step: Step; category: string }[] = []
  const steps = run.steps

  // First step (early reasoning)
  if (steps.length > 0 && steps[0].passed) {
    quotes.push({ step: steps[0], category: 'Early rounds (clear reasoning)' })
  }

  // A mid-game step (around the middle, preferring one with longer reasoning)
  const mid = Math.floor(steps.length / 2)
  const midCandidates = steps.slice(
    Math.max(1, mid - 2),
    Math.min(steps.length - 1, mid + 3),
  )
  const midStep = midCandidates
    .filter((s) => s.passed)
    .sort((a, b) => b.judge_result.reasoning.length - a.judge_result.reasoning.length)[0]
  if (midStep) {
    quotes.push({ step: midStep, category: 'Mid-game (growing complexity)' })
  }

  // Last passed step or the failed step
  const lastStep = steps[steps.length - 1]
  if (lastStep && quotes.length < maxQuotes) {
    const category = lastStep.passed
      ? 'Deep water'
      : 'Deep water (the breaking point)'
    quotes.push({ step: lastStep, category })
  }

  return quotes
}
