import { useState } from 'react'
import type { RunResult } from '../types'
import StepTrace from './StepTrace'
import JudgeQuote from './JudgeQuote'
import { pickJudgeQuotes } from '../lib/analyze'

interface Props {
  run: RunResult
}

export default function RunAccordion({ run }: Props) {
  const [open, setOpen] = useState(false)
  const peakLevel = Math.max(...run.steps.map((s) => s.target_level), 0)
  const quotes = pickJudgeQuotes(run)

  return (
    <div className={`run-detail ${open ? 'open' : ''}`}>
      <div className="run-header" onClick={() => setOpen(!open)}>
        <span className="run-id">{run.run_id.slice(0, 8)}</span>
        <span className="run-summary">
          {run.total_steps} steps &middot; peak level {peakLevel} &middot; round {run.max_round}
        </span>
        <span className={`run-result ${run.failure ? 'fail' : 'pass'}`}>
          {run.failure ? 'Failed' : 'Complete'}
        </span>
      </div>
      <div className="run-body" style={{ display: open ? 'block' : 'none' }}>
        <h3>Step Trace</h3>
        <StepTrace steps={run.steps} />

        {quotes.length > 0 && (
          <>
            <h3 className="!mt-6">Selected Judge Reasoning</h3>
            {quotes.map((q) => (
              <JudgeQuote key={q.step.step_index} step={q.step} category={q.category} />
            ))}
          </>
        )}

        {run.failure && (
          <>
            <h3 className="!mt-6">Failure Details</h3>
            <p className="!text-sm">
              Expected level {run.failure.expected_level}, detected level{' '}
              {run.failure.detected_level}. Judge reasoning:
            </p>
            <div className="judge-quote">
              &ldquo;{run.failure.reasoning}&rdquo;
            </div>
          </>
        )}
      </div>
    </div>
  )
}
