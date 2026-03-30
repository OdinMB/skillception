import type { GroupStats } from '../types'

interface Props {
  groups: GroupStats[]
  totalRuns: number
}

export default function Abstract({ groups, totalRuns }: Props) {
  const allMaxRounds = groups.flatMap((g) =>
    g.group.runs.map((r) => r.max_round),
  )
  const overallMax = Math.max(...allMaxRounds, 0)
  const peakLevel = overallMax + 2 // ascent goes to round+2
  const overallMedian = median(allMaxRounds)

  return (
    <div className="abstract">
      <div className="abstract-label">Abstract</div>
      <p className="!mb-0">
        We investigate the maximum depth of meta-recursive skill generation
        achievable by a large language model through blind evaluation. A Skill
        Creator (level 0) creates skills. A Skill Creator Creator (level 1)
        creates Skill Creators. We continue this chain until the model can no
        longer maintain semantic coherence across ascending and descending
        meta-levels. Across {totalRuns} independent run{totalRuns !== 1 && 's'},{' '}
        the median maximum round reached was {overallMedian.toFixed(1)}
        {overallMax > 0 && (
          <>
            , with {groups.length > 1 ? 'at least one run' : 'one run'} achieving
            round {overallMax} (meta-level {peakLevel})
          </>
        )}
        . These results suggest that Claude can hold more levels of recursive
        abstraction in its head than most humans can comfortably read about.
      </p>
    </div>
  )
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}
