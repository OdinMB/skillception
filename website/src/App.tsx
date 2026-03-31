import { useEffect, useState } from "react";
import type { RunResult, GroupStats, RoundTokenStats, AgentTokenStats } from "./types";
import {
  discardErrorRuns,
  groupByExecutorAndJudge,
  computeStats,
  computeTokensByRound,
  computeMeanStepTokens,
  pickFailureQuotes,
  buildGroupedRoundData,
  failPct,
  variantLabel,
} from "./lib/analyze";
import JournalHeader from "./components/JournalHeader";
import Abstract from "./components/Abstract";
import RoundDistributionChart from "./components/RoundDistributionChart";
import RoundDiagram from "./components/RoundDiagram";
import RunOverview from "./components/RunAccordion";
import TokenChart from "./components/TokenChart";
import Footer from "./components/Footer";

const MODEL_ORDER = ["opus", "sonnet", "haiku"] as const;
const MODEL_LABELS: Record<string, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
};
const MODEL_COLORS: Record<string, string> = {
  opus: "var(--color-ink)",
  sonnet: "var(--color-blue)",
  haiku: "var(--color-red)",
};

interface JudgeVariant {
  judgeName: string;
  judgeLabel: string;
  runs: RunResult[];
  stats: GroupStats;
  tokensByRound: Map<number, RoundTokenStats>;
}

interface ModelData {
  name: string;
  label: string;
  variants: JudgeVariant[];
}

/** Preferred judge display order: opus first (external), then self. */
const JUDGE_ORDER = ["opus", "sonnet", "haiku"];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function processRunData(data: RunResult[]): { models: ModelData[]; discarded: number } {
  const clean = discardErrorRuns(data);
  const discarded = data.length - clean.length;
  const byExecutorAndJudge = groupByExecutorAndJudge(clean);
  const modelData: ModelData[] = [];
  for (const executorName of MODEL_ORDER) {
    const judgeMap = byExecutorAndJudge.get(executorName);
    if (!judgeMap) continue;
    const variants: JudgeVariant[] = [];
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
        tokensByRound: computeTokensByRound(runs),
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
  return { models: modelData, discarded };
}

// --- Preloaded summary types (serialized Maps as entry arrays) ---

interface SerializedStats {
  totalRuns: number;
  roundDistribution: [number, number][];
  maxRound: number;
  meanRound: number;
  medianRound: number;
  ascentPass: number;
  ascentTotal: number;
  descentPass: number;
  descentTotal: number;
  failureCount: number;
}

export interface PreloadedSummary {
  discarded: number;
  models: Array<{
    name: string;
    label: string;
    variants: Array<{
      judgeName: string;
      judgeLabel: string;
      runs: RunResult[];
      stats: SerializedStats;
      tokensByRound: [number, { executor: AgentTokenStats; judge: AgentTokenStats }][];
    }>;
  }>;
  stepRows: Array<{ role: string; model: string; tokens: number }>;
}

function deserializeSummary(summary: PreloadedSummary): {
  models: ModelData[];
  discarded: number;
  stepRows: Array<{ role: string; model: string; tokens: number }>;
} {
  return {
    discarded: summary.discarded,
    stepRows: summary.stepRows,
    models: summary.models.map((m) => ({
      name: m.name,
      label: m.label,
      variants: m.variants.map((v) => ({
        judgeName: v.judgeName,
        judgeLabel: v.judgeLabel,
        runs: v.runs,
        stats: {
          ...v.stats,
          roundDistribution: new Map(v.stats.roundDistribution),
        },
        tokensByRound: new Map(v.tokensByRound),
      })),
    })),
  };
}

export interface AppProps {
  initialData?: RunResult[];
  preloadedSummary?: PreloadedSummary;
}

function App({ initialData, preloadedSummary }: AppProps) {
  const initial = (() => {
    if (preloadedSummary) return deserializeSummary(preloadedSummary);
    if (initialData) {
      const result = processRunData(initialData);
      return { ...result, stepRows: null };
    }
    return null;
  })();

  const [models, setModels] = useState<ModelData[]>(initial?.models ?? []);
  const [discarded, setDiscarded] = useState(initial?.discarded ?? 0);
  const [precomputedStepRows] = useState(initial?.stepRows ?? null);
  const [runTab, setRunTab] = useState(0);
  const [quoteTab, setQuoteTab] = useState(0);
  const [runsOpen, setRunsOpen] = useState(false);
  const [tokenChartsOpen, setTokenChartsOpen] = useState(false);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [fullDataLoaded, setFullDataLoaded] = useState(!!initialData);

  useEffect(() => {
    if (initialData) return;

    // If we have summary data, start background fetch of full data
    // If no summary, this is the primary data load
    fetch("/results.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load results: ${r.status}`);
        return r.json();
      })
      .then((data: RunResult[]) => {
        const result = processRunData(data);
        setModels(result.models);
        setDiscarded(result.discarded);
        setFullDataLoaded(true);
        setLoading(false);
      })
      .catch((e) => {
        // If we already have summary data, swallow the error — page still works
        if (preloadedSummary) {
          setFullDataLoaded(false);
          return;
        }
        setError(e.message);
        setLoading(false);
      });
  }, [initialData, preloadedSummary]);

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
        <div
          className="figure"
          style={{ textAlign: "center", marginTop: "2rem" }}
        >
          <p style={{ fontStyle: "italic", color: "var(--color-footnote)" }}>
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

  const TOKEN_COLORS = {
    output: "var(--color-red)",
    input: "var(--color-blue)",
    cacheRead: "var(--color-green)",
    cacheCreation: "var(--color-amber)",
  };

  function buildTokenRows(
    tokensByRound: Map<number, RoundTokenStats>,
    agent: "executor" | "judge",
  ) {
    const rounds = [...tokensByRound.keys()].sort((a, b) => a - b);
    return rounds.map((r) => {
      const stats = tokensByRound.get(r)![agent];
      return {
        label: `Round ${r}`,
        segments: [
          {
            value: stats.outputTokens,
            color: TOKEN_COLORS.output,
            name: "Output",
          },
          {
            value: stats.inputTokens,
            color: TOKEN_COLORS.input,
            name: "Input",
          },
          {
            value: stats.cacheReadInputTokens,
            color: TOKEN_COLORS.cacheRead,
            name: "Cache Read",
          },
          {
            value: stats.cacheCreationInputTokens,
            color: TOKEN_COLORS.cacheCreation,
            name: "Cache Write",
          },
        ],
      };
    });
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
        Figure 2 presents the distribution of maximum rounds reached by each
        model tier under different judge configurations. Each round consists of
        an ascent to a new peak meta-level followed by a full descent back to
        level 1:
      </p>

      <div className="figure figure--borderless">
        <div className="figure-content">
          <RoundDiagram />
        </div>
        <div className="figure-caption">
          <span className="fig-label">Figure 1:</span> Anatomy of a run. Each
          round ascends one level higher than the last, then descends all the
          way back to level 1, verifying each generated skill on the way down. A
          run ends when either the executor or the judge fails to maintain
          coherence at a given level.
        </div>
      </div>

      {(() => {
        const allVariants = models.flatMap((m) =>
          m.variants.map((v) => ({
            label: `${m.label} (N=${v.stats.totalRuns})`,
            color: MODEL_COLORS[m.name] ?? "var(--color-footnote)",
            stats: v.stats,
          })),
        );
        const labels = allVariants.map((v) => v.label);
        const colors = allVariants.map((v) => v.color);
        const data = buildGroupedRoundData(allVariants);
        return (
          <div
            className="figure figure--borderless"
            style={{ marginTop: "32px" }}
          >
            <div className="figure-content">
              <RoundDistributionChart
                data={data}
                labels={labels}
                colors={colors}
              />
            </div>
            <div className="figure-caption">
              <span className="fig-label">Figure 2:</span> Share of runs ending
              at each round, by model tier. Each round adds one meta-level
              (round 1: level 1 &rarr; 2, round 9: level 9 &rarr; 10). Round 9
              completion indicates a full ascent to level 10 and descent back to
              level 1.
            </div>
          </div>
        );
      })()}

      {/* Section 2: Failure Analysis */}
      <h2>
        <span className="section-number">2.</span> Failure Analysis
      </h2>
      <p>
        Table 1 summarizes failure rates by direction and judge configuration.
        All evaluations are blind: the judge receives only the generated
        SKILL.md text with no knowledge of which model produced it or what
        meta-level was intended. A mismatch between expected and detected level
        is a failure of the model as a whole &mdash; the executor may have
        drifted from the target abstraction, or the judge may have misread the
        output, or both. Same-tier pairings (e.g. Sonnet/Sonnet) test whether
        the model can stay semantically consistent with itself across deepening
        recursion layers.
      </p>

      <div className="figure">
        <div className="figure-content table-scroll">
          <table>
            <thead>
              <tr>
                <th>Executor</th>
                <th>Judge</th>
                <th>Runs</th>
                <th>Avg Round</th>
                <th>Ascent Fail %</th>
                <th>Descent Fail %</th>
              </tr>
            </thead>
            <tbody>
              {models.flatMap((m) =>
                m.variants.map((v) => (
                  <tr key={`${m.name}-${v.judgeName}`}>
                    <td>{m.label}</td>
                    <td>{v.judgeLabel}</td>
                    <td className="num">{v.stats.totalRuns}</td>
                    <td className="num">{v.stats.meanRound.toFixed(1)}</td>
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
          <span className="fig-label">Table 1:</span> Performance by executor
          model, judge, and step direction.
        </div>
      </div>

      {/* Sample judge quotes with tabs for each variant */}
      {(() => {
        const quoteVariants = models.flatMap((m) =>
          m.variants
            .filter((v) => v.stats.failureCount > 0)
            .map((v) => ({ model: m, variant: v })),
        );
        if (quoteVariants.length === 0) return null;
        const safeQuoteTab = quoteTab < quoteVariants.length ? quoteTab : 0;
        const activeQuote = quoteVariants[safeQuoteTab];
        const quotes = activeQuote
          ? pickFailureQuotes(activeQuote.variant.runs, 2)
          : [];
        return (
          <>
            <h3>Sample failures as described by the judge</h3>
            <div className="model-tabs">
              {quoteVariants.map((item, i) => (
                <button
                  key={`${item.model.name}-${item.variant.judgeName}`}
                  className={`model-tab ${i === safeQuoteTab ? "active" : ""}`}
                  onClick={() => setQuoteTab(i)}
                >
                  {variantLabel(
                    item.model.name,
                    item.model.label,
                    item.variant.judgeName,
                    item.variant.judgeLabel,
                  )}
                </button>
              ))}
            </div>
            {quotes.map((q) => (
              <div className="judge-quote" key={q.run.run_id}>
                &ldquo;{q.reasoning}&rdquo;
                <div className="attribution">
                  &mdash; {activeQuote.variant.judgeLabel} judge,{" "}
                  {q.description}
                </div>
              </div>
            ))}
          </>
        );
      })()}

      {/* Run details (expandable, no separate section heading) */}
      <div
        className="run-detail"
        style={{ cursor: "pointer", marginTop: "24px" }}
      >
        <div
          className="run-header"
          onClick={() => setRunsOpen(!runsOpen)}
          style={{ justifyContent: "center", gap: "8px" }}
        >
          <span style={{ color: "var(--color-footnote)" }}>
            {runsOpen ? "Collapse" : "Expand"} individual run details with full
            judge evaluations
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
                  : ` \u00d7 ${item.variant.judgeLabel}`}{" "}
                ({item.variant.stats.totalRuns})
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

      {/* Section 4: Resource Consumption */}
      <h2>
        <span className="section-number">3.</span> Resource Consumption
      </h2>

      {/* Per-step cost table and summary (primary content) */}
      {(() => {
        // Use pre-computed step rows from summary, or compute from full data
        let stepRows: { role: string; model: string; tokens: number }[];
        if (precomputedStepRows && !fullDataLoaded) {
          stepRows = precomputedStepRows;
        } else {
          const byExecutor = new Map<string, RunResult[]>();
          const byJudge = new Map<string, RunResult[]>();
          for (const m of models) {
            for (const v of m.variants) {
              if (!byExecutor.has(m.name)) byExecutor.set(m.name, []);
              byExecutor.get(m.name)!.push(...v.runs);
              if (!byJudge.has(v.judgeName)) byJudge.set(v.judgeName, []);
              byJudge.get(v.judgeName)!.push(...v.runs);
            }
          }
          stepRows = [];
          for (const name of MODEL_ORDER) {
            const execRuns = byExecutor.get(name);
            const judgeRuns = byJudge.get(name);
            if (execRuns) {
              const mean = computeMeanStepTokens(execRuns);
              if (mean.stepCount > 0)
                stepRows.push({
                  role: "Executor",
                  model: MODEL_LABELS[name] ?? name,
                  tokens: mean.executor,
                });
            }
            if (judgeRuns) {
              const mean = computeMeanStepTokens(judgeRuns);
              if (mean.stepCount > 0)
                stepRows.push({
                  role: "Judge",
                  model: MODEL_LABELS[name] ?? name,
                  tokens: mean.judge,
                });
            }
          }
        }

        if (stepRows.length === 0) return null;

        return (
          <>
            <p>
              Token consumption per step is roughly constant regardless of
              meta-level — the per-round cost growth visible in Figure 3 comes
              entirely from higher rounds having more steps. Round{" "}
              <span style={{ fontStyle: "italic" }}>R</span> has{" "}
              <span style={{ fontStyle: "italic" }}>R</span>+1 steps (one ascent
              plus <span style={{ fontStyle: "italic" }}>R</span> descent steps
              back to level 1), so each successive round costs one step more
              than the last. In the interest of full transparency: this entire
              experiment consumed a quantity of tokens that could generously be
              described as &ldquo;needlessly extravagant.&rdquo; The scientific
              value per token decreases with each additional run. The
              entertainment value, however, does not. We regret nothing.
            </p>

            <div className="figure">
              <div className="figure-content">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Role</th>
                      <th>Tokens / Step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stepRows.map((row) => (
                      <tr key={`${row.role}-${row.model}`}>
                        <td>{row.model}</td>
                        <td>{row.role}</td>
                        <td className="num">{formatTokens(row.tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="figure-caption">
                <span className="fig-label">Table 2:</span> Mean total token
                consumption per step by model and role, pooled across all judge
                and executor pairings respectively. Per-step token cost is
                roughly constant regardless of meta-level or round.
              </div>
            </div>
          </>
        );
      })()}

      {/* Per-round token charts (collapsible) */}
      <div className="run-detail" style={{ cursor: "pointer" }}>
        <div
          className="run-header"
          onClick={() => setTokenChartsOpen(!tokenChartsOpen)}
          style={{ justifyContent: "center", gap: "8px" }}
        >
          <span style={{ color: "var(--color-footnote)" }}>
            {tokenChartsOpen ? "Collapse" : "Expand"} per-round token breakdown
          </span>
          <span style={{ fontSize: "10px", color: "var(--color-caption)" }}>
            {tokenChartsOpen ? "\u25BC" : "\u25B6"}
          </span>
        </div>
      </div>

      {tokenChartsOpen && (
        <>
          <p>
            Figure 3 shows the mean token consumption per completed round for
            each model tier. Only runs that successfully finished all steps in a
            given round contribute to that round&rsquo;s average.
          </p>

          {models.map((m, mi) => (
            <div key={`tokens-${m.name}`}>
              {m.variants.map((v, vi) => {
                const executorRoundRows = buildTokenRows(
                  v.tokensByRound,
                  "executor",
                );
                const judgeRoundRows = buildTokenRows(v.tokensByRound, "judge");
                if (executorRoundRows.length === 0) return null;
                const runCounts = [...v.tokensByRound.values()].map(
                  (s) => s.executor.runCount,
                );
                const minRuns = Math.min(...runCounts);
                const maxRuns = Math.max(...runCounts);
                return (
                  <div key={`tokens-${m.name}-${v.judgeName}`}>
                    <div className="figure">
                      <h3>
                        {variantLabel(
                          m.name,
                          m.label,
                          v.judgeName,
                          v.judgeLabel,
                        )}
                        : executor tokens per round (N=
                        {minRuns === maxRuns
                          ? maxRuns
                          : `${minRuns}–${maxRuns}`}{" "}
                        runs)
                      </h3>
                      <div className="figure-content">
                        <TokenChart rows={executorRoundRows} />
                      </div>
                      {mi === 0 && vi === 0 && (
                        <div className="figure-caption">
                          <span className="fig-label">Figure 3:</span> Mean
                          executor token consumption per completed round, broken
                          down by category. Higher rounds have fewer
                          contributing runs (only runs that completed that round
                          are included).
                        </div>
                      )}
                    </div>
                    <div className="figure">
                      <h3>
                        {variantLabel(
                          m.name,
                          m.label,
                          v.judgeName,
                          v.judgeLabel,
                        )}
                        : judge tokens per round
                      </h3>
                      <div className="figure-content">
                        <TokenChart rows={judgeRoundRows} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}

      <hr className="thin-rule" />

      {/* Open Source */}
      <h2>
        <span className="section-number">4.</span> Source Code
      </h2>
      <p>
        The complete experiment harness, agent prompts, raw results, and this
        website are open-sourced under the MIT License at{" "}
        <a
          href="https://github.com/OdinMB/skillception"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/OdinMB/skillception
        </a>
        . Contributions are welcome — whether that means adding new model
        configurations, improving the judge prompt, or pushing the recursion to
        levels that would make Hofstadter uncomfortable.
      </p>

      <hr className="thin-rule" />

      {/* References */}
      <h2>
        <span className="section-number">5.</span> References
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
          <sup>1</sup> Claude designed the experiment, executed it, judged it,
          analyzed the results, built the website, and wrote everything up.
          Odin&rsquo;s contribution was typing &ldquo;python
          scripts/run_experiment.py&rdquo; and then going to make coffee. He
          did, however, insist on being credited, which tells you everything
          about academia.
        </p>
      </div>

      <Footer />
    </div>
  );
}

export default App;
