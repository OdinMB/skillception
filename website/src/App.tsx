import { useEffect, useState } from "react";
import type { RunResult, GroupStats } from "./types";
import {
  discardErrorRuns,
  groupByExecutorAndJudge,
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

interface JudgeVariant {
  judgeName: string;
  judgeLabel: string;
  runs: RunResult[];
  stats: GroupStats;
}

interface ModelData {
  name: string;
  label: string;
  variants: JudgeVariant[];
}

/** Preferred judge display order: opus first (external), then self. */
const JUDGE_ORDER = ["opus", "sonnet", "haiku"];

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
        const byExecutorAndJudge = groupByExecutorAndJudge(clean);
        const modelData: ModelData[] = [];
        for (const executorName of MODEL_ORDER) {
          const judgeMap = byExecutorAndJudge.get(executorName);
          if (!judgeMap) continue;
          const variants: JudgeVariant[] = [];
          // Sort judges: opus first, then others in MODEL_ORDER
          const judgeNames = [...judgeMap.keys()].sort(
            (a, b) => JUDGE_ORDER.indexOf(a) - JUDGE_ORDER.indexOf(b),
          );
          for (const judgeName of judgeNames) {
            const runs = judgeMap.get(judgeName)!;
            variants.push({
              judgeName,
              judgeLabel: MODEL_LABELS[judgeName] ?? judgeName,
              runs,
              stats: computeStats(runs),
            });
          }
          if (variants.length > 0) {
            modelData.push({
              name: executorName,
              label: MODEL_LABELS[executorName] ?? executorName,
              variants,
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

  // Collect all variants for global chart scaling
  const allVariants = models.flatMap((m) => m.variants);
  const allMaxRounds = allVariants.flatMap((v) =>
    Array.from(v.stats.roundDistribution.keys()),
  );
  const globalMinRound = Math.min(...allMaxRounds, 0);
  const globalMaxRound = Math.max(...allMaxRounds, 0);
  const globalMaxCount = Math.max(
    ...allVariants.flatMap((v) => Array.from(v.stats.roundDistribution.values())),
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

  function failPct(pass: number, total: number): string {
    if (total === 0) return "\u2014";
    const failRate = ((total - pass) / total) * 100;
    return failRate === 0 ? "0%" : `${failRate.toFixed(1)}%`;
  }

  function variantLabel(model: ModelData, variant: JudgeVariant): string {
    if (model.name === variant.judgeName) {
      return `${model.label} (self-judged)`;
    }
    return `${model.label} (judged by ${variant.judgeLabel})`;
  }

  // Build flat list of (model, variant) pairs for the run overview tabs
  const runTabItems = models.flatMap((m) =>
    m.variants.map((v) => ({ model: m, variant: v })),
  );
  const safeRunTab = runTab < runTabItems.length ? runTab : 0;
  const activeRunItem = runTabItems[safeRunTab];

  return (
    <div className="page">
      <JournalHeader />

      <Abstract
        models={models.map((m) => ({
          name: m.label,
          variants: m.variants.map((v) => ({
            judgeLabel: v.judgeLabel,
            isSelfJudged: m.name === v.judgeName,
            stats: v.stats,
          })),
        }))}
        discarded={discarded}
      />

      {/* Section 1: Round Distributions */}
      <h2>
        <span className="section-number">1.</span> Round Distributions
      </h2>
      <p>
        Figure 1 presents the distribution of maximum rounds reached by each
        model tier under different judge configurations. Each round consists of
        an ascent to a new peak meta-level followed by a full descent back to
        level 1.
      </p>

      {models.map((m, mi) => (
        <div key={m.name}>
          {m.variants.map((v, vi) => (
            <div className="figure" key={`${m.name}-${v.judgeName}`}>
              <h3>
                {variantLabel(m, v)} (N={v.stats.totalRuns})
              </h3>
              <div className="figure-content">
                <BarChart
                  bars={buildRoundBars(v.stats)}
                  maxValue={globalMaxCount}
                />
              </div>
              {mi === 0 && vi === 0 && (
                <div className="figure-caption">
                  <span className="fig-label">Figure 1:</span> Distribution of
                  maximum round reached by model tier and judge. Each round adds
                  one level (round 1: level 1 &rarr; 2, round 9: level 9 &rarr; 10).
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Section 2: Failure Analysis */}
      <h2>
        <span className="section-number">2.</span> Failure Analysis
      </h2>
      <p>
        Table 1 summarizes failure rates by direction and judge configuration.
        For each executor model, we compare performance when judged by Opus
        versus self-judged, testing whether a model grades its own
        meta-recursive output more leniently than an external evaluator.
      </p>

      <div className="figure">
        <div className="figure-content">
          <table>
            <thead>
              <tr>
                <th>Executor</th>
                <th>Judge</th>
                <th>Runs</th>
                <th>Failures</th>
                <th>Ascent Fail %</th>
                <th>Descent Fail %</th>
              </tr>
            </thead>
            <tbody>
              {models.flatMap((m) =>
                m.variants.map((v) => (
                  <tr key={`${m.name}-${v.judgeName}`}>
                    <td>{m.label}</td>
                    <td>
                      {m.name === v.judgeName
                        ? <span style={{ fontStyle: "italic" }}>Self</span>
                        : v.judgeLabel}
                    </td>
                    <td className="num">{v.stats.totalRuns}</td>
                    <td className="num">{v.stats.failureCount}</td>
                    <td className="num">
                      {failPct(v.stats.ascentPass, v.stats.ascentTotal)}
                    </td>
                    <td className="num">
                      {failPct(v.stats.descentPass, v.stats.descentTotal)}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <div className="figure-caption">
          <span className="fig-label">Table 1:</span> Failure rates by executor
          model, judge, and step direction.
        </div>
      </div>

      {/* Sample judge quotes for failed variants */}
      {models
        .flatMap((m) =>
          m.variants
            .filter((v) => v.stats.failureCount > 0)
            .map((v) => ({ model: m, variant: v })),
        )
        .map(({ model: m, variant: v }) => {
          const quotes = pickFailureQuotes(v.runs, 2);
          if (quotes.length === 0) return null;
          return (
            <div key={`${m.name}-${v.judgeName}`}>
              <h3>
                {variantLabel(m, v)}: sample judge reasoning
              </h3>
              {quotes.map((q) => (
                <div className="judge-quote" key={q.run.run_id}>
                  &ldquo;{q.reasoning}&rdquo;
                  <div className="attribution">
                    &mdash; {v.judgeLabel} judge, {q.description}
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
            {runTabItems.map((item, i) => (
              <button
                key={`${item.model.name}-${item.variant.judgeName}`}
                className={`model-tab ${i === safeRunTab ? "active" : ""}`}
                onClick={() => setRunTab(i)}
              >
                {item.model.label}
                {item.model.name === item.variant.judgeName
                  ? " (self)"
                  : ` \u00d7 ${item.variant.judgeLabel}`}
                {" "}({item.variant.stats.totalRuns})
              </button>
            ))}
          </div>

          {activeRunItem && (
            <div style={{ marginTop: "16px" }}>
              <RunOverview runs={activeRunItem.variant.runs} />
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
