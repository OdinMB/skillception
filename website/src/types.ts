export interface JudgeResult {
  detected_level: number
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
  detected_level: number
  reasoning: string
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
