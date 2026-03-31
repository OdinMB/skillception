// --- BEGIN GENERATED TYPES (do not edit manually — see scripts/result_schema.py) ---
export interface JudgeResult {
  detected_level: number | null
  reasoning: string
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

export interface Step {
  step_index: number
  round: number
  direction: 'ascent' | 'descent'
  source_level: number
  target_level: number
  passed: boolean
  expected_level: number
  executor_usage: TokenUsage | null
  judge_usage: TokenUsage | null
  judge_result: JudgeResult
}

export interface Failure {
  round: number
  step_index: number
  expected_level: number
  detected_level: number | null
  reasoning: string
  error?: false | 'call' | 'parse'
}

export interface RunResult {
  run_id: string
  model: string
  judge_model: string
  timestamp: string
  max_round: number
  total_steps: number
  total_usage: TokenUsage | null
  steps: Step[]
  failure: Failure | null
  /** Pre-computed by prerender when steps are stripped from summary data */
  _peakLevel?: number
  /** Pre-computed by prerender when steps are stripped from summary data */
  _failureDescription?: string
}
// --- END GENERATED TYPES ---

export interface AgentTokenStats extends TokenUsage {
  runCount: number
}

export interface RoundTokenStats {
  executor: AgentTokenStats
  judge: AgentTokenStats
}

export interface GroupStats {
  totalRuns: number
  roundDistribution: Map<number, number>
  maxRound: number
  meanRound: number
  medianRound: number
  ascentPass: number
  ascentTotal: number
  descentPass: number
  descentTotal: number
  failureCount: number
}
