import { useEffect, useState } from "react";
import type { RunResult, GroupStats } from "./types";
import {
  discardErrorRuns,
  filterOpusJudged,
  computeStats,
  pickFailureQuotes,
} from "./lib/analyze";
import JournalHeader from "./components/JournalHeader";
import Abstract from "./components/Abstract";
import BarChart from "./components/BarChart";
import RunOverview from "./components/RunAccordion";

const MODEL_ORDER = ["opus", "sonnet", "haiku"] as const;
const MODEL_LABELS: Record<string, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
};

interface ModelData {
  name: string;
  label: string;
  runs: RunResult[];
  stats: GroupStats;
}

function App() {
  const [models, setModels] = useState<ModelData[]>([]);
  const [discarded, setDiscarded] = useState(0);
  const [runTab, setRunTab] = useState(0);
  const [runsOpen, setRunsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/results.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load results: ${r.status}`);
        return r.json();
      })
      .then((data: RunResult[]) => {
        const clean = discardErrorRuns(data);
        setDiscarded(data.length - clean.length);
        const byModel = filterOpusJudged(clean);
        const modelData: ModelData[] = [];
        for (const name of MODEL_ORDER) {
          const runs = byModel.get(name) ?? [];
          if (runs.length > 0) {
            modelData.push({
              name,
              label: MODEL_LABELS[name] ?? name,
              runs,
              stats: computeStats(runs),
            });
          }
        }
        setModels(modelData);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="page">
        <p className="text-center" style={{ marginTop: "40vh" }}>
          Loading experimental data&hellip;
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <JournalHeader />
        <div className="figure" style={{ textAlign: "center", marginTop: "2rem" }}>
          <p style={{ fontStyle: "italic", color: "var(--color-body)" }}>
            No experimental data available.
          </p>
          <p
            style={{
              color: "var(--color-footnote)",
              fontSize: "14px",
              marginTop: "1rem",
            }}
          >
            Run <code>npm run website:export-data</code> from the repo root to
            generate <code>results.json</code> from completed runs.
          </p>
        </div>
      </div>
    );
  }

  // Build round distribution bars per model
  const allMaxRounds = models.flatMap((m) =>
    Array.from(m.stats.roundDistribution.keys()),
  );
  const globalMinRound = Math.min(...allMaxRounds, 0);
  const globalMaxRound = Math.max(...allMaxRounds, 0);
  const globalMaxCount = Math.max(
    ...models.flatMap((m) => Array.from(m.stats.roundDistribution.values())),
    1,
  );

  function buildRoundBars(stats: GroupStats) {
    const bars = [];
    for (let r = globalMinRound; r <= globalMaxRound; r++) {
      const count = stats.roundDistribution.get(r) ?? 0;
      bars.push({ label: `Round ${r}`, value: count });
    }
    return bars;
  }

  // Failure percentages
  function failPct(pass: number, total: number): string {
    if (total === 0) return "\u2014";
    const failRate = ((total - pass) / total) * 100;
    return failRate === 0 ? "0%" : `${failRate.toFixed(1)}%`;
  }

  const activeRunModel = models[runTab];

  return (
    <div className="page">
      <JournalHeader />

      <Abstract
        models={models.map((m) => ({ name: m.label, stats: m.stats }))}
        discarded={discarded}
      />

      {/* Section 1: Round Distributions */}
      <h2>
        <span className="section-number">1.</span> Round Distributions
      </h2>
      <p>
        Figure 1 presents the distribution of maximum rounds reached by each
        model tier, all judged blindly by Opus. Each round consists of an ascent
        to a new peak meta-level followed by a full descent back to level 1.
      </p>

      {models.map((m, i) => (
        <div className="figure" key={m.name}>
          <h3>
            {m.label} (N={m.stats.totalRuns})
          </h3>
          <div className="figure-content">
            <BarChart
              bars={buildRoundBars(m.stats)}
              maxValue={globalMaxCount}
            />
          </div>
          {i === 0 && (
            <div className="figure-caption">
              <span className="fig-label">Figure 1:</span> Distribution of
              maximum round reached by model tier. Each round adds one level
              (round 1: level 1 &rarr; 2, round 9: level 9 &rarr; 10).
              {models.length === 3 && (
                <>
                  {" "}
                  Mean rounds &mdash;{" "}
                  {models
                    .map(
                      (m2) => `${m2.label}: ${m2.stats.meanRound.toFixed(1)}`,
                    )
                    .join(", ")}
                  .
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Section 2: Failure Analysis */}
      <h2>
        <span className="section-number">2.</span> Failure Analysis
      </h2>
      <p>
        Table 1 summarizes failure rates by direction. Ascent steps create a
        skill at a higher meta-level; descent steps cascade back down to level
        1. Failures occur when the blind judge detects a different meta-level
        than the executor intended.
      </p>

      <div className="figure">
        <div className="figure-content">
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Runs</th>
                <th>Failures</th>
                <th>Ascent Fail %</th>
                <th>Descent Fail %</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.name}>
                  <td>{m.label}</td>
                  <td className="num">{m.stats.totalRuns}</td>
                  <td className="num">{m.stats.failureCount}</td>
                  <td className="num">
                    {failPct(m.stats.ascentPass, m.stats.ascentTotal)}
                  </td>
                  <td className="num">
                    {failPct(m.stats.descentPass, m.stats.descentTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="figure-caption">
          <span className="fig-label">Table 1:</span> Failure rates by model and
          step direction.
          {models.find((m) => m.name === "opus")?.stats.failureCount === 0 && (
            <>
              {" "}
              Opus completed all rounds without a single mismatch, which is
              either impressive or suspicious.
            </>
          )}
        </div>
      </div>

      {/* Sample judge quotes for failed models */}
      {models
        .filter((m) => m.stats.failureCount > 0)
        .map((m) => {
          const quotes = pickFailureQuotes(m.runs, 2);
          if (quotes.length === 0) return null;
          return (
            <div key={m.name}>
              <h3>{m.label}: sample judge reasoning</h3>
              {quotes.map((q) => (
                <div className="judge-quote" key={q.run.run_id}>
                  &ldquo;{q.reasoning}&rdquo;
                  <div className="attribution">
                    &mdash; Judge, {q.description}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

      {/* Section 3: Run Overview */}
      <h2>
        <span className="section-number">3.</span> Run Overview
      </h2>

      <div className="run-detail" style={{ cursor: "pointer" }}>
        <div
          className="run-header"
          onClick={() => setRunsOpen(!runsOpen)}
          style={{ justifyContent: "center", gap: "8px" }}
        >
          <span style={{ color: "var(--color-footnote)" }}>
            {runsOpen ? "Collapse" : "Expand"} individual run details
          </span>
          <span style={{ fontSize: "10px", color: "var(--color-caption)" }}>
            {runsOpen ? "\u25BC" : "\u25B6"}
          </span>
        </div>
      </div>

      {runsOpen && (
        <>
          <div className="model-tabs">
            {models.map((m, i) => (
              <button
                key={m.name}
                className={`model-tab ${i === runTab ? "active" : ""}`}
                onClick={() => setRunTab(i)}
              >
                {m.label} ({m.stats.totalRuns})
              </button>
            ))}
          </div>

          {activeRunModel && (
            <div style={{ marginTop: "16px" }}>
              <RunOverview runs={activeRunModel.runs} />
            </div>
          )}
        </>
      )}

      <hr className="thin-rule" />

      {/* References */}
      <h2>
        <span className="section-number">4.</span> References
      </h2>
      <div className="references">
        <ol>
          <li>
            Hofstadter, D. R. (1979).{" "}
            <span className="ref-title">
              G&ouml;del, Escher, Bach: An Eternal Golden Braid.
            </span>{" "}
            Basic Books. Still the only book most people cite when they want to
            sound smart about recursion.
          </li>
          <li>
            Anthropic. (2026). &ldquo;Claude Code Skill Creator Plugin.&rdquo;{" "}
            <span className="ref-title">Internal Documentation.</span> The thing
            that started all of this.
          </li>
          <li>
            Nobody. (2026). &ldquo;A Practical Guide to Meta-Recursive Skill
            Generation.&rdquo;{" "}
            <span className="ref-title">
              Unpublished, and likely to remain so.
            </span>
          </li>
          <li>
            This Paper. (2026). &ldquo;On the Recursive Limits of Meta-Skill
            Generation in Large Language Models.&rdquo;{" "}
            <span className="ref-title">
              Proceedings of the Dept. of Recursion Studies,
            </span>{" "}
            1(1). Yes, we cited ourselves. The recursion demanded it.
          </li>
        </ol>
      </div>

      <hr className="thin-rule" />

      {/* Footnotes */}
      <div className="footnote">
        <p>
          <sup>1</sup> And also Claude. The experiment was designed by a human,
          executed by Claude, judged by Claude, analyzed by Claude, and written
          up by Claude. The human&rsquo;s contribution was typing &ldquo;python
          scripts/run_experiment.py&rdquo; and then going to make coffee.
        </p>
      </div>
    </div>
  );
}

export default App;
