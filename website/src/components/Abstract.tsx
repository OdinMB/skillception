import type { GroupStats } from '../types'

interface VariantInfo {
  judgeLabel: string
  isSelfJudged: boolean
  stats: GroupStats
}

interface Props {
  models: { name: string; variants: VariantInfo[] }[]
  discarded: number
}

export default function Abstract({ models, discarded }: Props) {
  const totalRuns = models.reduce(
    (sum, m) => sum + m.variants.reduce((vs, v) => vs + v.stats.totalRuns, 0),
    0,
  )
  const allStats = models.flatMap((m) => m.variants.map((v) => v.stats))
  const overallMax = Math.max(...allStats.map((s) => s.maxRound), 0)
  const peakLevel = overallMax >= 1 ? overallMax + 1 : null

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
        , we compare Claude model tiers &mdash;{' '}
        {models.map((m) => m.name).join(', ')} &mdash; under two judging
        regimes: external evaluation by Opus and self-evaluation by the
        executor&rsquo;s own model tier. {peakLevel !== null
          ? <>The peak recursion level reached was {peakLevel}.</>
          : <>No runs completed a full round.</>}
        {' '}These results illuminate not only how deep each model
        can recurse, but whether models grade their own meta-recursive output
        more charitably than an external evaluator does.
      </p>
    </div>
  )
}
