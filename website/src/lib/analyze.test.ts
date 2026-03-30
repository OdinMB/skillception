import { describe, it, expect } from 'vitest'
import type { RunResult, Failure, Step } from '../types'
import {
  discardErrorRuns,
  groupByExecutorAndJudge,
  computeStats,
  formatFailureStep,
  pickFailureQuotes,
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
