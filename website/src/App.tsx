import { useEffect, useState } from 'react'
import type { RunResult, GroupStats, ModelGroup } from './types'
import { discardErrorRuns, groupByModels, computeStats } from './lib/analyze'
import JournalHeader from './components/JournalHeader'
import Abstract from './components/Abstract'
import SummaryTable from './components/SummaryTable'
import BarChart from './components/BarChart'
import RunAccordion from './components/RunAccordion'

function App() {
  const [allResults, setAllResults] = useState<RunResult[]>([])
  const [discarded, setDiscarded] = useState(0)
  const [groups, setGroups] = useState<{ group: ModelGroup; stats: GroupStats }[]>([])
  const [activeGroup, setActiveGroup] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/results.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load results: ${r.status}`)
        return r.json()
      })
      .then((data: RunResult[]) => {
        const { clean, discarded: d } = discardErrorRuns(data)
        setAllResults(data)
        setDiscarded(d)
        const modelGroups = groupByModels(clean)
        setGroups(modelGroups.map((g) => ({ group: g, stats: computeStats(g) })))
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="page">
        <p className="text-center" style={{ marginTop: '40vh' }}>Loading experimental data&hellip;</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <p className="text-center" style={{ marginTop: '40vh', color: 'var(--color-red)' }}>
          {error}
        </p>
        <p className="text-center" style={{ color: 'var(--color-footnote)', fontSize: '14px' }}>
          Run <code>npm run export-data</code> in the website directory to generate results.json
        </p>
      </div>
    )
  }

  const current = groups[activeGroup]
  if (!current) return null

  const { stats } = current
  const runs = current.group.runs

  // Build round distribution bars
  const maxRoundValue = Math.max(...Array.from(stats.roundDistribution.values()), 1)
  const allRoundKeys = Array.from(stats.roundDistribution.keys()).sort((a, b) => a - b)
  const minRound = Math.min(...allRoundKeys, 0)
  const maxRound = Math.max(...allRoundKeys, 0)
  const roundBars = []
  for (let r = minRound; r <= maxRound; r++) {
    const count = stats.roundDistribution.get(r) ?? 0
    roundBars.push({
      label: `Round ${r}`,
      value: count,
      color: (count > 0 ? (r === maxRound ? 'blue' : 'red') : 'red') as 'red' | 'blue' | 'green',
    })
  }

  // Build direction pass rate bars
  const directionBars = [
    {
      label: 'Ascent',
      value: stats.ascentTotal > 0 ? (stats.ascentPass / stats.ascentTotal) * 100 : 0,
      display: `${stats.ascentPass}/${stats.ascentTotal}`,
      color: 'green' as const,
    },
    {
      label: 'Descent',
      value: stats.descentTotal > 0 ? (stats.descentPass / stats.descentTotal) * 100 : 0,
      display: `${stats.descentPass}/${stats.descentTotal}`,
      color: 'green' as const,
    },
  ]

  // Sort runs by max_round descending for the accordion
  const sortedRuns = [...runs].sort((a, b) => b.max_round - a.max_round)

  // Find the best run for the featured step trace
  const bestRun = sortedRuns[0]

  return (
    <div className="page">
      <JournalHeader totalRuns={allResults.length} discardedRuns={discarded} />

      <Abstract groups={groups.map((g) => g.stats)} totalRuns={runs.length} />

      {/* Model group tabs */}
      {groups.length > 1 && (
        <div className="model-tabs">
          {groups.map((g, i) => (
            <button
              key={g.group.label}
              className={`model-tab ${i === activeGroup ? 'active' : ''}`}
              onClick={() => setActiveGroup(i)}
            >
              {g.group.label}
            </button>
          ))}
        </div>
      )}

      {/* Section 1: Results */}
      <h2><span className="section-number">1.</span> Results</h2>
      <p>
        Table 1 summarizes the {runs.length} experimental run{runs.length !== 1 && 's'} conducted
        {groups.length > 1 && <> for <strong>{current.group.label}</strong></>}.
        {stats.failureCount > 0
          ? <> {stats.failureCount} run{stats.failureCount !== 1 && 's'} encountered
            failure conditions before completing all rounds.<sup className="fn" title="We use 'failure conditions' in the technical sense, not the existential one.">2</sup></>
          : <> All runs completed successfully, which is either impressive or suspicious.</>
        }
      </p>

      <div className="figure">
        <div className="figure-content">
          <SummaryTable runs={runs} />
        </div>
        <div className="figure-caption">
          <span className="fig-label">Table 1:</span> Summary of experimental runs
          ({current.group.label}).
          {stats.maxRound > 3 && (
            <> The peak meta-level reached was {stats.maxRound + 2} &mdash; a &ldquo;Skill{' '}
            {'Creator '.repeat(stats.maxRound + 2).trim()}&rdquo;.{' '}
            <em>We counted the &ldquo;Creator&rdquo;s {stats.maxRound + 2 > 4 ? 'three times to be sure' : 'twice to be sure'}.</em></>
          )}
        </div>
      </div>

      {/* Section 2: Round Distribution */}
      <h2><span className="section-number">2.</span> Round Distribution</h2>
      <p>
        Figure 1 presents the distribution of maximum rounds reached.
        {runs.length <= 3
          ? <> With a sample size of {runs.length}, we acknowledge this is less a distribution
            and more of {runs.length === 1 ? 'a lonely data point' : runs.length === 2 ? 'a pair of data points making meaningful eye contact across a chart' : 'a small gathering of data points'}.</>
          : <> The distribution across {runs.length} runs provides a
            {runs.length < 10 ? ' modest but' : ''} meaningful sample.</>
        }
      </p>

      <div className="figure">
        <div className="figure-content">
          <BarChart bars={roundBars} maxValue={maxRoundValue} />
        </div>
        <div className="figure-caption">
          <span className="fig-label">Figure 1:</span> Distribution of maximum round reached
          across experimental runs (N={runs.length}).
          {' '}Mean: {stats.meanRound.toFixed(1)}, Median: {stats.medianRound.toFixed(1)}.
        </div>
      </div>

      {/* Section 3: Step-Level Analysis */}
      <h2><span className="section-number">3.</span> Step-Level Analysis</h2>
      <p>
        Figure 2 shows the pass rate by direction. Ascent steps (creating a skill at a higher
        meta-level than the source) and descent steps (cascading back down to level 0) exhibited
        different failure characteristics.
      </p>

      <div className="figure">
        <div className="figure-content">
          <BarChart bars={directionBars} maxValue={100} />
        </div>
        <div className="figure-caption">
          <span className="fig-label">Figure 2:</span> Pass rate by step direction.
          {stats.ascentPass === stats.ascentTotal && stats.ascentTotal > 0
            ? <> Ascent maintained a perfect record.</>
            : <> Ascent passed {stats.ascentPass} of {stats.ascentTotal} steps.</>
          }
          {' '}Descent passed {stats.descentPass} of {stats.descentTotal} steps.
        </div>
      </div>

      {/* Section 4: Featured Run Trace */}
      {bestRun && (
        <>
          <h2><span className="section-number">4.</span> Detailed Run Traces</h2>
          <p>
            Each run can be expanded below to reveal its full step trace and selected judge
            reasoning. Runs are sorted by maximum round reached, descending.
          </p>
          {sortedRuns.map((run) => (
            <RunAccordion key={run.run_id} run={run} />
          ))}
        </>
      )}

      <hr className="thin-rule" />

      {/* Section 5: References */}
      <h2><span className="section-number">5.</span> References</h2>
      <div className="references">
        <ol>
          <li>Hofstadter, D. R. (1979). <span className="ref-title">G&ouml;del, Escher, Bach: An Eternal Golden Braid.</span> Basic Books. Still the only book most people cite when they want to sound smart about recursion.</li>
          <li>Anthropic. (2026). &ldquo;Claude Code Skill Creator Plugin.&rdquo; <span className="ref-title">Internal Documentation.</span> The thing that started all of this.</li>
          <li>Nobody. (2026). &ldquo;A Practical Guide to Meta-Recursive Skill Generation.&rdquo; <span className="ref-title">Unpublished, and likely to remain so.</span></li>
          <li>This Paper. (2026). &ldquo;On the Recursive Limits of Meta-Skill Generation in Large Language Models.&rdquo; <span className="ref-title">Proceedings of the Dept. of Recursive Skill Studies,</span> 1(1). Yes, we cited ourselves. The recursion demanded it.</li>
        </ol>
      </div>

      <hr className="thin-rule" />

      {/* Footnotes */}
      <div className="footnote">
        <p><sup>1</sup> And also Claude. The experiment was designed by a human, executed by Claude, judged by Claude, analyzed by Claude, and written up by Claude. The human&rsquo;s contribution was typing <code>python scripts/run_experiment.py</code> and then going to make coffee.</p>
        <p><sup>2</sup> We use &ldquo;failure conditions&rdquo; in the technical sense, not the existential one, though at higher meta-levels the distinction becomes academic.</p>
      </div>
    </div>
  )
}

export default App
