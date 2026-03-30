import { describe, it, expect } from 'vitest'
import type { RunResult, Failure, Step, TokenUsage, GroupStats } from '../types'
import {
  discardErrorRuns,
  groupByExecutorAndJudge,
  computeStats,
  computeTokensByRound,
  computeMeanStepTokens,
  formatFailureStep,
  pickFailureQuotes,
  buildRoundBars,
  failPct,
  variantLabel,
  formatDetectedLevel,
} from './analyze'

/** Factory for RunResult with sensible defaults. Override only what you need. */
function makeRun(overrides: Partial<RunResult> = {}): RunResult {
  return {
    run_id: 'test-run',
    model: 'opus',
    judge_model: 'opus',
    timestamp: '2026-01-01T00:00:00Z',
    max_round: 1,
    total_steps: 2,
    total_usage: null,
    steps: [],
    failure: null,
    ...overrides,
  }
}

function makeStep(overrides: Partial<Step> = {}): Step {
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
    judge_result: { detected_level: 2, reasoning: 'ok' },
    ...overrides,
  }
}

function makeFailure(overrides: Partial<Failure> = {}): Failure {
  return {
    round: 1,
    step_index: 0,
    expected_level: 2,
    detected_level: 1,
    reasoning: 'mismatch',
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

function makeUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    inputTokens: 10,
    outputTokens: 100,
    cacheReadInputTokens: 1000,
    cacheCreationInputTokens: 500,
    ...overrides,
  }
}

// --- discardErrorRuns ---

describe('discardErrorRuns', () => {
  it('returns empty for empty input', () => {
    expect(discardErrorRuns([])).toEqual([])
  })

  it('keeps runs without failure', () => {
    const runs = [makeRun(), makeRun()]
    expect(discardErrorRuns(runs)).toHaveLength(2)
  })

  it('keeps mismatch failures (error: false)', () => {
    const runs = [makeRun({ failure: makeFailure({ error: false }) })]
    expect(discardErrorRuns(runs)).toHaveLength(1)
  })

  it('filters call error failures (error: "call")', () => {
    const runs = [makeRun({ failure: makeFailure({ error: 'call', detected_level: null }) })]
    expect(discardErrorRuns(runs)).toHaveLength(0)
  })

  it('filters parse error failures (error: "parse")', () => {
    const runs = [makeRun({ failure: makeFailure({ error: 'parse', detected_level: null }) })]
    expect(discardErrorRuns(runs)).toHaveLength(0)
  })

  it('keeps indeterminate failures (error: false, detected_level: -1)', () => {
    const runs = [makeRun({ failure: makeFailure({ error: false, detected_level: -1 }) })]
    expect(discardErrorRuns(runs)).toHaveLength(1)
  })

  it('handles mixed runs correctly', () => {
    const runs = [
      makeRun(),  // no failure — keep
      makeRun({ failure: makeFailure({ error: false }) }),  // mismatch — keep
      makeRun({ failure: makeFailure({ error: 'call', detected_level: null }) }),  // error — discard
      makeRun({ failure: makeFailure({ error: false, detected_level: -1 }) }),  // indeterminate — keep
    ]
    expect(discardErrorRuns(runs)).toHaveLength(3)
  })
})

// --- groupByExecutorAndJudge ---

describe('groupByExecutorAndJudge', () => {
  it('groups single model into one group', () => {
    const runs = [makeRun({ model: 'opus', judge_model: 'opus' })]
    const groups = groupByExecutorAndJudge(runs)
    expect(groups.size).toBe(1)
    expect(groups.get('opus')?.get('opus')).toHaveLength(1)
  })

  it('separates different executor models', () => {
    const runs = [
      makeRun({ model: 'opus', judge_model: 'opus' }),
      makeRun({ model: 'sonnet', judge_model: 'opus' }),
    ]
    const groups = groupByExecutorAndJudge(runs)
    expect(groups.size).toBe(2)
  })

  it('separates different judge models under same executor', () => {
    const runs = [
      makeRun({ model: 'opus', judge_model: 'opus' }),
      makeRun({ model: 'opus', judge_model: 'sonnet' }),
    ]
    const groups = groupByExecutorAndJudge(runs)
    const opusGroup = groups.get('opus')!
    expect(opusGroup.size).toBe(2)
  })

  it('defaults missing model to opus', () => {
    const run = makeRun()
    // @ts-expect-error -- testing missing field
    delete run.model
    // @ts-expect-error -- testing missing field
    delete run.judge_model
    const groups = groupByExecutorAndJudge([run])
    expect(groups.get('opus')?.get('opus')).toHaveLength(1)
  })
})

// --- computeStats ---

describe('computeStats', () => {
  it('handles empty array without division by zero', () => {
    const stats = computeStats([])
    expect(stats.totalRuns).toBe(0)
    expect(stats.meanRound).toBe(0)
    expect(stats.medianRound).toBe(0)
    expect(stats.maxRound).toBe(0)
  })

  it('computes stats for single run', () => {
    const steps = [
      makeStep({ direction: 'ascent', passed: true }),
      makeStep({ direction: 'descent', passed: true, step_index: 1 }),
    ]
    const stats = computeStats([makeRun({ max_round: 1, steps })])
    expect(stats.totalRuns).toBe(1)
    expect(stats.maxRound).toBe(1)
    expect(stats.meanRound).toBe(1)
    expect(stats.ascentTotal).toBe(1)
    expect(stats.descentTotal).toBe(1)
    expect(stats.ascentPass).toBe(1)
    expect(stats.descentPass).toBe(1)
  })

  it('computes correct mean and median for multiple runs', () => {
    const runs = [
      makeRun({ max_round: 1 }),
      makeRun({ max_round: 3 }),
      makeRun({ max_round: 5 }),
    ]
    const stats = computeStats(runs)
    expect(stats.meanRound).toBe(3)
    expect(stats.medianRound).toBe(3)
    expect(stats.maxRound).toBe(5)
  })

  it('computes median for even number of runs', () => {
    const runs = [
      makeRun({ max_round: 1 }),
      makeRun({ max_round: 3 }),
      makeRun({ max_round: 5 }),
      makeRun({ max_round: 7 }),
    ]
    const stats = computeStats(runs)
    expect(stats.medianRound).toBe(4) // (3 + 5) / 2
  })

  it('counts failures correctly', () => {
    const runs = [
      makeRun({ failure: null }),
      makeRun({ failure: makeFailure() }),
      makeRun({ failure: makeFailure() }),
    ]
    const stats = computeStats(runs)
    expect(stats.failureCount).toBe(2)
  })

  it('counts pass/fail by direction', () => {
    const steps = [
      makeStep({ direction: 'ascent', passed: true }),
      makeStep({ direction: 'ascent', passed: false }),
      makeStep({ direction: 'descent', passed: true }),
    ]
    const stats = computeStats([makeRun({ steps })])
    expect(stats.ascentPass).toBe(1)
    expect(stats.ascentTotal).toBe(2)
    expect(stats.descentPass).toBe(1)
    expect(stats.descentTotal).toBe(1)
  })
})

// --- formatFailureStep ---

describe('formatFailureStep', () => {
  it('returns dash for no failure', () => {
    expect(formatFailureStep(makeRun())).toBe('\u2014')
  })

  it('returns round number when step not found', () => {
    const run = makeRun({
      failure: makeFailure({ round: 3, step_index: 99 }),
      steps: [],
    })
    expect(formatFailureStep(run)).toBe('round 3')
  })

  it('formats ascent failure', () => {
    const run = makeRun({
      failure: makeFailure({ step_index: 0 }),
      steps: [makeStep({ step_index: 0, direction: 'ascent', target_level: 3 })],
    })
    expect(formatFailureStep(run)).toBe('ascent to level 3')
  })

  it('formats descent failure', () => {
    const run = makeRun({
      failure: makeFailure({ step_index: 1 }),
      steps: [
        makeStep({ step_index: 0 }),
        makeStep({ step_index: 1, direction: 'descent', source_level: 3, target_level: 2 }),
      ],
    })
    expect(formatFailureStep(run)).toBe('descent 3 \u2192 2')
  })
})

// --- pickFailureQuotes ---

describe('pickFailureQuotes', () => {
  it('returns empty for no failed runs', () => {
    expect(pickFailureQuotes([makeRun()])).toEqual([])
  })

  it('returns fewer than count when not enough failures', () => {
    const runs = [makeRun({ failure: makeFailure() })]
    const picks = pickFailureQuotes(runs, 5)
    expect(picks).toHaveLength(1)
  })

  it('returns exactly count when enough failures', () => {
    const runs = Array.from({ length: 10 }, (_, i) =>
      makeRun({
        run_id: `run-${i}`,
        failure: makeFailure({ expected_level: i + 1 }),
        steps: [makeStep({ step_index: 0, direction: 'ascent', target_level: i + 1 })],
      })
    )
    const picks = pickFailureQuotes(runs, 3)
    expect(picks).toHaveLength(3)
  })

  it('displays "error" for null detected_level', () => {
    const run = makeRun({
      failure: makeFailure({ detected_level: null, error: 'call' }),
      steps: [makeStep({ step_index: 0 })],
    })
    const picks = pickFailureQuotes([run])
    expect(picks[0].description).toContain('error')
  })

  it('displays numeric detected_level for mismatches', () => {
    const run = makeRun({
      failure: makeFailure({ detected_level: 3 }),
      steps: [makeStep({ step_index: 0 })],
    })
    const picks = pickFailureQuotes([run])
    expect(picks[0].description).toContain('3')
  })
})

// --- buildRoundBars ---

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

// --- failPct ---

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

// --- variantLabel ---

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

// --- formatDetectedLevel ---

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

  it('formats null detected_level with error string', () => {
    const failure: Failure = {
      round: 1,
      step_index: 0,
      expected_level: 3,
      detected_level: null,
      reasoning: 'crashed',
      error: 'call',
    }
    expect(formatDetectedLevel(failure)).toBe('call error')
  })

  it('formats null detected_level without error string', () => {
    const failure: Failure = {
      round: 1,
      step_index: 0,
      expected_level: 3,
      detected_level: null,
      reasoning: 'unknown',
    }
    expect(formatDetectedLevel(failure)).toBe('error')
  })
})

// --- computeTokensByRound ---

describe('computeTokensByRound', () => {
  it('returns empty map for empty input', () => {
    const result = computeTokensByRound([])
    expect(result.size).toBe(0)
  })

  it('returns exact values for a single run with one round', () => {
    const runs = [
      makeRun({
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            direction: 'ascent',
            executor_usage: makeUsage({ outputTokens: 200 }),
            judge_usage: makeUsage({ outputTokens: 50 }),
          }),
          makeStep({
            round: 1,
            direction: 'descent',
            step_index: 1,
            executor_usage: makeUsage({ outputTokens: 300 }),
            judge_usage: makeUsage({ outputTokens: 80 }),
          }),
        ],
      }),
    ]
    const result = computeTokensByRound(runs)
    expect(result.size).toBe(1)
    const round1 = result.get(1)!
    expect(round1.executor.outputTokens).toBe(500) // 200 + 300
    expect(round1.executor.inputTokens).toBe(20) // 10 + 10
    expect(round1.executor.runCount).toBe(1)
    expect(round1.judge.outputTokens).toBe(130) // 50 + 80
    expect(round1.judge.runCount).toBe(1)
  })

  it('averages across multiple runs for the same round', () => {
    const runs = [
      makeRun({
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            executor_usage: makeUsage({ outputTokens: 100 }),
            judge_usage: makeUsage({ outputTokens: 40 }),
          }),
        ],
      }),
      makeRun({
        run_id: 'run-2',
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            executor_usage: makeUsage({ outputTokens: 200 }),
            judge_usage: makeUsage({ outputTokens: 60 }),
          }),
        ],
      }),
    ]
    const result = computeTokensByRound(runs)
    const round1 = result.get(1)!
    expect(round1.executor.outputTokens).toBe(150) // (100 + 200) / 2
    expect(round1.executor.runCount).toBe(2)
    expect(round1.judge.outputTokens).toBe(50) // (40 + 60) / 2
  })

  it('handles null executor_usage by skipping', () => {
    const runs = [
      makeRun({
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            executor_usage: null,
            judge_usage: makeUsage({ outputTokens: 50 }),
          }),
        ],
      }),
      makeRun({
        run_id: 'run-2',
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            executor_usage: makeUsage({ outputTokens: 200 }),
            judge_usage: null,
          }),
        ],
      }),
    ]
    const result = computeTokensByRound(runs)
    const round1 = result.get(1)!
    // Only one run had executor usage
    expect(round1.executor.outputTokens).toBe(200)
    expect(round1.executor.runCount).toBe(1)
    // Only one run had judge usage
    expect(round1.judge.outputTokens).toBe(50)
    expect(round1.judge.runCount).toBe(1)
  })

  it('separates entries per round for multi-round runs', () => {
    const runs = [
      makeRun({
        max_round: 2,
        steps: [
          makeStep({
            round: 1,
            direction: 'ascent',
            executor_usage: makeUsage({ outputTokens: 100 }),
            judge_usage: makeUsage({ outputTokens: 30 }),
          }),
          makeStep({
            round: 1,
            direction: 'descent',
            step_index: 1,
            executor_usage: makeUsage({ outputTokens: 150 }),
            judge_usage: makeUsage({ outputTokens: 40 }),
          }),
          makeStep({
            round: 2,
            direction: 'ascent',
            step_index: 2,
            executor_usage: makeUsage({ outputTokens: 400 }),
            judge_usage: makeUsage({ outputTokens: 90 }),
          }),
          makeStep({
            round: 2,
            direction: 'descent',
            step_index: 3,
            executor_usage: makeUsage({ outputTokens: 500 }),
            judge_usage: makeUsage({ outputTokens: 110 }),
          }),
        ],
      }),
    ]
    const result = computeTokensByRound(runs)
    expect(result.size).toBe(2)
    expect(result.get(1)!.executor.outputTokens).toBe(250) // 100 + 150
    expect(result.get(2)!.executor.outputTokens).toBe(900) // 400 + 500
    expect(result.get(1)!.judge.outputTokens).toBe(70) // 30 + 40
    expect(result.get(2)!.judge.outputTokens).toBe(200) // 90 + 110
  })

  it('tracks all four token fields', () => {
    const runs = [
      makeRun({
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            executor_usage: {
              inputTokens: 10,
              outputTokens: 100,
              cacheReadInputTokens: 5000,
              cacheCreationInputTokens: 2000,
            },
            judge_usage: {
              inputTokens: 5,
              outputTokens: 50,
              cacheReadInputTokens: 3000,
              cacheCreationInputTokens: 1000,
            },
          }),
        ],
      }),
    ]
    const result = computeTokensByRound(runs)
    const r1 = result.get(1)!
    expect(r1.executor.inputTokens).toBe(10)
    expect(r1.executor.outputTokens).toBe(100)
    expect(r1.executor.cacheReadInputTokens).toBe(5000)
    expect(r1.executor.cacheCreationInputTokens).toBe(2000)
    expect(r1.judge.inputTokens).toBe(5)
    expect(r1.judge.outputTokens).toBe(50)
    expect(r1.judge.cacheReadInputTokens).toBe(3000)
    expect(r1.judge.cacheCreationInputTokens).toBe(1000)
  })

  it('excludes rounds where a step failed', () => {
    const runs = [
      makeRun({
        max_round: 2,
        steps: [
          makeStep({
            round: 1,
            direction: 'ascent',
            passed: true,
            executor_usage: makeUsage({ outputTokens: 100 }),
            judge_usage: makeUsage({ outputTokens: 30 }),
          }),
          makeStep({
            round: 1,
            direction: 'descent',
            step_index: 1,
            passed: true,
            executor_usage: makeUsage({ outputTokens: 150 }),
            judge_usage: makeUsage({ outputTokens: 40 }),
          }),
          makeStep({
            round: 2,
            direction: 'ascent',
            step_index: 2,
            passed: true,
            executor_usage: makeUsage({ outputTokens: 400 }),
            judge_usage: makeUsage({ outputTokens: 90 }),
          }),
          makeStep({
            round: 2,
            direction: 'descent',
            step_index: 3,
            passed: false, // failed — round 2 incomplete
            executor_usage: makeUsage({ outputTokens: 500 }),
            judge_usage: makeUsage({ outputTokens: 110 }),
          }),
        ],
      }),
    ]
    const result = computeTokensByRound(runs)
    // Round 1 completed, round 2 did not
    expect(result.size).toBe(1)
    expect(result.has(1)).toBe(true)
    expect(result.has(2)).toBe(false)
    expect(result.get(1)!.executor.outputTokens).toBe(250)
  })
})

// --- computeMeanStepTokens ---

describe('computeMeanStepTokens', () => {
  it('returns zeros for empty input', () => {
    const result = computeMeanStepTokens([])
    expect(result.executor).toBe(0)
    expect(result.judge).toBe(0)
    expect(result.stepCount).toBe(0)
  })

  it('computes mean total tokens per step for a single run', () => {
    // makeUsage defaults: input=10, output=100, cacheRead=1000, cacheCreate=500 → total=1610
    const runs = [
      makeRun({
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            direction: 'ascent',
            executor_usage: makeUsage({ outputTokens: 200 }),
            // total: 10 + 200 + 1000 + 500 = 1710
            judge_usage: makeUsage({ outputTokens: 50 }),
            // total: 10 + 50 + 1000 + 500 = 1560
          }),
          makeStep({
            round: 1,
            direction: 'descent',
            step_index: 1,
            executor_usage: makeUsage({ outputTokens: 300 }),
            // total: 10 + 300 + 1000 + 500 = 1810
            judge_usage: makeUsage({ outputTokens: 80 }),
            // total: 10 + 80 + 1000 + 500 = 1590
          }),
        ],
      }),
    ]
    const result = computeMeanStepTokens(runs)
    expect(result.executor).toBe(1760) // (1710 + 1810) / 2
    expect(result.judge).toBe(1575) // (1560 + 1590) / 2
    expect(result.stepCount).toBe(2)
  })

  it('averages across multiple runs', () => {
    const runs = [
      makeRun({
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            executor_usage: makeUsage(), // total 1610
            judge_usage: makeUsage(),    // total 1610
          }),
        ],
      }),
      makeRun({
        run_id: 'run-2',
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            executor_usage: makeUsage({ outputTokens: 200 }), // total 1710
            judge_usage: makeUsage({ outputTokens: 200 }),     // total 1710
          }),
        ],
      }),
    ]
    const result = computeMeanStepTokens(runs)
    expect(result.executor).toBe(1660) // (1610 + 1710) / 2
    expect(result.judge).toBe(1660)
    expect(result.stepCount).toBe(2)
  })

  it('excludes steps from incomplete rounds', () => {
    const runs = [
      makeRun({
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            passed: true,
            executor_usage: makeUsage(),
            judge_usage: makeUsage(),
          }),
          makeStep({
            round: 1,
            step_index: 1,
            passed: false,
            executor_usage: makeUsage(),
            judge_usage: makeUsage(),
          }),
        ],
      }),
    ]
    const result = computeMeanStepTokens(runs)
    expect(result.executor).toBe(0)
    expect(result.stepCount).toBe(0)
  })

  it('handles null usage by skipping', () => {
    const runs = [
      makeRun({
        max_round: 1,
        steps: [
          makeStep({
            round: 1,
            executor_usage: null,
            judge_usage: makeUsage(), // total 1610
          }),
        ],
      }),
    ]
    const result = computeMeanStepTokens(runs)
    expect(result.executor).toBe(0)
    expect(result.judge).toBe(1610)
    expect(result.stepCount).toBe(1)
  })
})
