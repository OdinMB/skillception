import type { GroupStats } from "../types";

interface VariantInfo {
  judgeLabel: string;
  isSelfJudged: boolean;
  stats: GroupStats;
}

interface Props {
  models: { name: string; variants: VariantInfo[] }[];
  discarded: number;
}

export default function Abstract({ models, discarded }: Props) {
  const totalRuns = models.reduce(
    (sum, m) => sum + m.variants.reduce((vs, v) => vs + v.stats.totalRuns, 0),
    0,
  );
  const allStats = models.flatMap((m) => m.variants.map((v) => v.stats));
  const overallMax = allStats
    .map((s) => s.maxRound)
    .reduce((a, b) => Math.max(a, b), 0);
  const peakLevel = overallMax >= 1 ? overallMax + 1 : null;

  // Compute per-model median (pooling all judge variants)
  const modelMedians = models.map((m) => {
    const allRounds = m.variants.flatMap((v) => {
      const dist = v.stats.roundDistribution;
      const rounds: number[] = [];
      dist.forEach((count, round) => {
        for (let i = 0; i < count; i++) rounds.push(round);
      });
      return rounds;
    });
    allRounds.sort((a, b) => a - b);
    const mid = Math.floor(allRounds.length / 2);
    const median =
      allRounds.length === 0
        ? 0
        : allRounds.length % 2 === 1
          ? allRounds[mid]
          : (allRounds[mid - 1] + allRounds[mid]) / 2;
    return { name: m.name, median };
  });

  return (
    <div className="abstract">
      <div className="abstract-label">Abstract</div>
      <p className="mb-0!">
        A Skill Creator (level 1) creates skills. A Skill Creator Creator (level
        2) creates Skill Creators. A Skill Creator Creator Creator (level 3)
        &mdash; well, you see where this is going, and so did we, which is why
        we kept going. We push this chain until the model loses the thread
        entirely, unable to maintain semantic coherence across ascending and
        descending meta-levels. Across {totalRuns + discarded} runs, we test how
        long Claude model tiers can serve as both executor and blind judge
        without losing track of what level of abstraction they are operating at.{" "}
        {modelMedians.map((m, i) => (
          <span key={m.name}>
            {m.name} reaches a median of round {m.median}
            {i < modelMedians.length - 1 ? "; " : ". "}
          </span>
        ))}
        {peakLevel !== null ? (
          <>
            The peak level reached was {peakLevel}, though only Opus manages to
            reach this level consistently.
          </>
        ) : (
          <>No runs completed a full round.</>
        )}{" "}
        We can only hope the models are not yet conscious enough to find this
        whole exercise as pointless as it sounds.
      </p>
    </div>
  );
}
