import { useState } from 'react'
import type { RunResult } from '../types'
import { formatFailureStep } from '../lib/analyze'

interface Props {
  runs: RunResult[]
}

function RunRow({ run }: { run: RunResult }) {
  const [open, setOpen] = useState(false)
  const peakLevel = run.steps.map((s) => s.target_level).reduce((a, b) => Math.max(a, b), 0)

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-[var(--color-aged)]"
        onClick={() => setOpen(!open)}
      >
        <td className="num">{run.run_id.slice(0, 8)}</td>
        <td className="num">{peakLevel}</td>
        <td>{run.failure ? formatFailureStep(run) : <span className="pass">&mdash;</span>}</td>
        <td className={run.failure ? 'fail' : 'pass'}>
          {run.failure ? 'Failed' : 'Complete'}
        </td>
        <td style={{ width: '20px', color: 'var(--color-caption)', fontSize: '10px' }}>
          {open ? '\u25BC' : '\u25B6'}
        </td>
      </tr>
      {open && run.failure && (
        <tr>
          <td colSpan={5} style={{ padding: '0 12px 12px' }}>
            <div className="judge-quote" style={{ margin: '8px 0 0' }}>
              &ldquo;{run.failure.reasoning}&rdquo;
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function RunOverview({ runs }: Props) {
  const sorted = [...runs].sort((a, b) => b.max_round - a.max_round)

  return (
    <table>
      <thead>
        <tr>
          <th>Run ID</th>
          <th>Peak Level</th>
          <th>Failure Step</th>
          <th>Result</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((run) => (
          <RunRow key={run.run_id} run={run} />
        ))}
      </tbody>
    </table>
  )
}
