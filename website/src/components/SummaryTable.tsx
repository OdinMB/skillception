import type { RunResult } from '../types'

interface Props {
  runs: RunResult[]
}

export default function SummaryTable({ runs }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>Run ID</th>
          <th>Model</th>
          <th>Max Round</th>
          <th>Steps</th>
          <th>Peak Level</th>
          <th>Failure Point</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => {
          const peakLevel = Math.max(...r.steps.map((s) => s.target_level), 0)
          return (
            <tr key={r.run_id}>
              <td className="num">{r.run_id.slice(0, 8)}</td>
              <td>{r.model}</td>
              <td className="num">{r.max_round}</td>
              <td className="num">{r.total_steps}</td>
              <td className="num">{peakLevel}</td>
              <td>
                {r.failure ? (
                  <>
                    Round {r.failure.round}, expected level {r.failure.expected_level} got{' '}
                    {r.failure.detected_level}
                  </>
                ) : (
                  <>&mdash;</>
                )}
              </td>
              <td className={r.failure ? 'fail' : 'pass'}>
                {r.failure
                  ? r.failure.detected_level === -1
                    ? 'Error'
                    : 'Mismatch'
                  : 'Complete'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
