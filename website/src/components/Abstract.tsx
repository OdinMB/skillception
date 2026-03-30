import type { GroupStats } from '../types'

interface Props {
  models: { name: string; stats: GroupStats }[]
  discarded: number
}

export default function Abstract({ models, discarded }: Props) {
  const totalRuns = models.reduce((sum, m) => sum + m.stats.totalRuns, 0)
  const overallMax = Math.max(...models.map((m) => m.stats.maxRound), 0)
  const peakLevel = overallMax >= 1 ? overallMax + 1 : 1

  return (
    <div className="abstract">
      <div className="abstract-label">Abstract</div>
      <p className="!mb-0">
        We investigate the maximum depth of meta-recursive skill generation
        achievable by large language models through blind evaluation. A Skill
        Creator (level 1) creates skills. A Skill Creator Creator (level 2)
        creates Skill Creators. The number of &ldquo;Creator&rdquo;s is the
        level. We continue this chain until the model can no longer maintain
        semantic coherence across ascending and descending meta-levels. Across {totalRuns} independent runs
        {discarded > 0 && <> ({discarded} error-terminated runs discarded)</>}
        , we compare three Claude model tiers &mdash; Opus, Sonnet, and
        Haiku &mdash; each judged blindly by Opus. The peak recursion level
        reached was {peakLevel}, achieved by Opus, which completed all rounds
        without failure. These results suggest that Claude can hold more levels
        of recursive abstraction in its head than most humans can comfortably
        read about.
      </p>
    </div>
  )
}
