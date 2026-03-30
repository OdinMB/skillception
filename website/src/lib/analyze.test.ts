import { describe, it, expect } from 'vitest'
import type { RunResult, GroupStats, Failure } from '../types'
import {
  discardErrorRuns,
  groupByExecutorAndJudge,
  computeStats,
  formatFailureStep,
  pickFailureQuotes,
  buildRoundBars,
  failPct,
  variantLabel,
  formatDetectedLevel,
} from './analyze'

/* ------------------------------------------------------------------ */
/*  Factories                                                          */
/* ------------------------------------------------------------------ */

function makeStep(overrides: Partial<RunResult['steps'][number]> = {}): RunResult['steps'][number] {
  return {
    step_index: 0,
    round: 1,
    direction: 'ascent',
    source_level: 1,
    target_level: 2,
    passed: true,
    expected_level: 2,
    executor_usage: null,
    judge_usage: null,
    judge_result: { detected_level: 2, reasoning: 'looks good' },
    ...overrides,
  }
}

function makeRun(overrides: Partial<RunResult> = {}): RunResult {
  return {
    run_id: 'test-0001',
    model: 'opus',
    judge_model: 'opus',
    timestamp: '2026-01-01T00:00:00Z',
    max_round: 1,
    total_steps: 1,
    total_usage: null,
    steps: [makeStep()],
    failure: null,
    ...overrides,
  }
}

function makeStats(overrides: Partial<GroupStats> = {}): GroupStats {
  return {
    totalRuns: 10,
    roundDistribution: new Map([[1, 5], [2, 3], [3, 2]]),
    maxRound: 3,
    meanRound: 1.7,
    medianRound: 1,
    ascentPass: 8,
    ascentTotal: 10,
    descentPass: 6,
    descentTotal: 8,
    failureCount: 2,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  discardErrorRuns                                                    */
/* ------------------------------------------------------------------ */

describe('discardErrorRuns', () => {
  it('keeps runs without failures', () => {
    const runs = [makeRun()]
    expect(discardErrorRuns(runs)).toHaveLength(1)
  })

  it('keeps runs with non-error failures (level mismatch)', () => {
    const runs = [
      makeRun({
        failure: {
          round: 1,
          step_index: 0,
          expected_level: 3,
          detected_level: 2,
          reasoning: 'level mismatch',
        },
      }),
    ]
    expect(discardErrorRuns(runs)).toHaveLength(1)
  })

  it('removes runs where detected_level is -1 (executor/judge error)', () => {
    const runs = [
      makeRun({
        failure: {
          round: 1,
          step_index: 0,
          expected_level: 2,
          detected_level: -1,
          reasoning: 'executor crashed',
        },
      }),
    ]
    expect(discardErrorRuns(runs)).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/*  groupByExecutorAndJudge                                            */
/* ------------------------------------------------------------------ */

describe('groupByExecutorAndJudge', () => {
  it('groups runs by executor then judge model', () => {
    const runs = [
      makeRun({ model: 'opus', judge_model: 'opus' }),
      makeRun({ model: 'opus', judge_model: 'haiku' }),
      makeRun({ model: 'sonnet', judge_model: 'opus' }),
    ]
    const grouped = groupByExecutorAndJudge(runs)
    expect(grouped.get('opus')?.get('opus')).toHaveLength(1)
    expect(grouped.get('opus')?.get('haiku')).toHaveLength(1)
    expect(grouped.get('sonnet')?.get('opus')).toHaveLength(1)
  })
})

/* ------------------------------------------------------------------ */
/*  computeStats                                                       */
/* ------------------------------------------------------------------ */

describe('computeStats', () => {
  it('computes correct round distribution', () => {
    const runs = [
      makeRun({ max_round: 2 }),
      makeRun({ max_round: 2 }),
      makeRun({ max_round: 3 }),
    ]
    const stats = computeStats(runs)
    expect(stats.roundDistribution.get(2)).toBe(2)
    expect(stats.roundDistribution.get(3)).toBe(1)
    expect(stats.totalRuns).toBe(3)
  })

  it('counts ascent and descent pass/total', () => {
    const runs = [
      makeRun({
        steps: [
          makeStep({ direction: 'ascent', passed: true }),
          makeStep({ direction: 'descent', passed: false }),
          makeStep({ direction: 'ascent', passed: true }),
        ],
      }),
    ]
    const stats = computeStats(runs)
    expect(stats.ascentPass).toBe(2)
    expect(stats.ascentTotal).toBe(2)
    expect(stats.descentPass).toBe(0)
    expect(stats.descentTotal).toBe(1)
  })

  it('returns zeros for empty runs', () => {
    const stats = computeStats([])
    expect(stats.totalRuns).toBe(0)
    expect(stats.maxRound).toBe(0)
    expect(stats.meanRound).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/*  buildRoundBars                                                     */
/* ------------------------------------------------------------------ */

describe('buildRoundBars', () => {
  it('produces bars for each round in the global range', () => {
    const stats = makeStats({
      roundDistribution: new Map([[1, 5], [3, 2]]),
    })
    const bars = buildRoundBars(stats, 1, 3)
    expect(bars).toHaveLength(3)
    expect(bars[0]).toEqual({ label: 'Round 1', value: 5 })
    expect(bars[1]).toEqual({ label: 'Round 2', value: 0 })
    expect(bars[2]).toEqual({ label: 'Round 3', value: 2 })
  })

  it('includes rounds with zero counts', () => {
    const stats = makeStats({
      roundDistribution: new Map([[2, 1]]),
    })
    const bars = buildRoundBars(stats, 0, 3)
    expect(bars).toHaveLength(4)
    expect(bars[0].value).toBe(0) // round 0
    expect(bars[2].value).toBe(1) // round 2
  })
})

/* ------------------------------------------------------------------ */
/*  failPct                                                            */
/* ------------------------------------------------------------------ */

describe('failPct', () => {
  it('returns em dash for zero total', () => {
    expect(failPct(0, 0)).toBe('\u2014')
  })

  it('returns 0% when all pass', () => {
    expect(failPct(10, 10)).toBe('0%')
  })

  it('computes correct failure percentage', () => {
    expect(failPct(7, 10)).toBe('30.0%')
  })

  it('handles single failure', () => {
    expect(failPct(9, 10)).toBe('10.0%')
  })
})

/* ------------------------------------------------------------------ */
/*  variantLabel                                                       */
/* ------------------------------------------------------------------ */

describe('variantLabel', () => {
  it('shows self-judged when model and judge match', () => {
    expect(variantLabel('opus', 'Opus', 'opus', 'Opus')).toBe('Opus (self-judged)')
  })

  it('shows judged by when model and judge differ', () => {
    expect(variantLabel('haiku', 'Haiku', 'opus', 'Opus')).toBe(
      'Haiku (judged by Opus)',
    )
  })
})

/* ------------------------------------------------------------------ */
/*  formatDetectedLevel                                                */
/* ------------------------------------------------------------------ */

describe('formatDetectedLevel', () => {
  it('formats expected and detected levels', () => {
    const failure: Failure = {
      round: 1,
      step_index: 0,
      expected_level: 3,
      detected_level: 2,
      reasoning: 'off by one',
    }
    expect(formatDetectedLevel(failure)).toBe('expected level 3, detected 2')
  })
})

/* ------------------------------------------------------------------ */
/*  formatFailureStep                                                  */
/* ------------------------------------------------------------------ */

describe('formatFailureStep', () => {
  it('returns em dash when no failure', () => {
    expect(formatFailureStep(makeRun())).toBe('\u2014')
  })

  it('formats ascent failure', () => {
    const run = makeRun({
      failure: {
        round: 1,
        step_index: 0,
        expected_level: 3,
        detected_level: 2,
        reasoning: 'wrong',
      },
      steps: [
        makeStep({
          step_index: 0,
          direction: 'ascent',
          target_level: 3,
        }),
      ],
    })
    expect(formatFailureStep(run)).toBe('ascent to level 3')
  })

  it('formats descent failure', () => {
    const run = makeRun({
      failure: {
        round: 1,
        step_index: 1,
        expected_level: 2,
        detected_level: 1,
        reasoning: 'wrong',
      },
      steps: [
        makeStep({ step_index: 0 }),
        makeStep({
          step_index: 1,
          direction: 'descent',
          source_level: 3,
          target_level: 2,
        }),
      ],
    })
    expect(formatFailureStep(run)).toBe('descent 3 \u2192 2')
  })
})

/* ------------------------------------------------------------------ */
/*  pickFailureQuotes                                                  */
/* ------------------------------------------------------------------ */

describe('pickFailureQuotes', () => {
  it('returns empty array when no failures', () => {
    expect(pickFailureQuotes([makeRun()])).toHaveLength(0)
  })

  it('picks up to count quotes from failed runs', () => {
    const failedRuns = Array.from({ length: 5 }, (_, i) =>
      makeRun({
        run_id: `fail-${i.toString().padStart(4, '0')}`,
        failure: {
          round: 1,
          step_index: 0,
          expected_level: i + 2,
          detected_level: i + 1,
          reasoning: `reasoning for level ${i + 2}`,
        },
        steps: [
          makeStep({
            step_index: 0,
            direction: 'ascent',
            target_level: i + 2,
          }),
        ],
      }),
    )
    const quotes = pickFailureQuotes(failedRuns, 2)
    expect(quotes).toHaveLength(2)
    expect(quotes[0].reasoning).toContain('reasoning for level')
  })
})
