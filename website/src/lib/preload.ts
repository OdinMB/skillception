import type { RunResult, AgentTokenStats } from "../types";
import {
  discardErrorRuns,
  groupByExecutorAndJudge,
  computeStats,
  computeTokensByRound,
  computeMeanStepTokens,
  formatFailureStep,
} from "./analyze";

const MODEL_ORDER = ["opus", "sonnet", "haiku"] as const;
const MODEL_LABELS: Record<string, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
};
const JUDGE_ORDER = ["opus", "sonnet", "haiku"];

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

/** Build the PreloadedSummary from raw run data (used by prerender script). */
export function buildPreloadSummary(data: RunResult[]): PreloadedSummary {
  const clean = discardErrorRuns(data);
  const discarded = data.length - clean.length;
  const byExecutorAndJudge = groupByExecutorAndJudge(clean);

  const summaryModels: PreloadedSummary["models"] = [];
  for (const executorName of MODEL_ORDER) {
    const judgeMap = byExecutorAndJudge.get(executorName);
    if (!judgeMap) continue;
    const variants: PreloadedSummary["models"][number]["variants"] = [];
    const judgeNames = [...judgeMap.keys()].sort(
      (a, b) => JUDGE_ORDER.indexOf(a) - JUDGE_ORDER.indexOf(b),
    );
    for (const judgeName of judgeNames) {
      const runs = judgeMap.get(judgeName)!;
      const stats = computeStats(runs);
      const tokensByRound = computeTokensByRound(runs);
      variants.push({
        judgeName,
        judgeLabel: MODEL_LABELS[judgeName] ?? judgeName,
        runs: runs.map((r) => ({
          ...r,
          steps: [],
          _failureDescription: r.failure ? formatFailureStep(r) : undefined,
          _peakLevel:
            r.steps.length > 0
              ? Math.max(...r.steps.map((s) => s.target_level))
              : 0,
        })),
        stats: {
          ...stats,
          roundDistribution: [...stats.roundDistribution.entries()] as [number, number][],
        },
        tokensByRound: [...tokensByRound.entries()] as [
          number,
          { executor: AgentTokenStats; judge: AgentTokenStats },
        ][],
      });
    }
    if (variants.length > 0) {
      summaryModels.push({
        name: executorName,
        label: MODEL_LABELS[executorName] ?? executorName,
        variants,
      });
    }
  }

  // Compute step token rows using original runs (with steps)
  const byExecutor = new Map<string, RunResult[]>();
  const byJudge = new Map<string, RunResult[]>();
  for (const executorName of MODEL_ORDER) {
    const judgeMap = byExecutorAndJudge.get(executorName);
    if (!judgeMap) continue;
    for (const [judgeName, runs] of judgeMap) {
      if (!byExecutor.has(executorName)) byExecutor.set(executorName, []);
      byExecutor.get(executorName)!.push(...runs);
      if (!byJudge.has(judgeName)) byJudge.set(judgeName, []);
      byJudge.get(judgeName)!.push(...runs);
    }
  }
  const stepRows: PreloadedSummary["stepRows"] = [];
  for (const name of MODEL_ORDER) {
    const execRuns = byExecutor.get(name);
    const judgeRuns = byJudge.get(name);
    if (execRuns) {
      const mean = computeMeanStepTokens(execRuns);
      if (mean.stepCount > 0)
        stepRows.push({ role: "Executor", model: MODEL_LABELS[name] ?? name, tokens: mean.executor });
    }
    if (judgeRuns) {
      const mean = computeMeanStepTokens(judgeRuns);
      if (mean.stepCount > 0)
        stepRows.push({ role: "Judge", model: MODEL_LABELS[name] ?? name, tokens: mean.judge });
    }
  }

  return { discarded, models: summaryModels, stepRows };
}
