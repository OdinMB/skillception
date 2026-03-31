import { renderToString } from 'react-dom/server'
import { StrictMode } from 'react'
import App from './App'
import type { RunResult } from './types'

export function render(data: RunResult[]): string {
  return renderToString(
    <StrictMode>
      <App initialData={data} />
    </StrictMode>,
  )
}

export {
  discardErrorRuns,
  groupByExecutorAndJudge,
  computeStats,
  computeTokensByRound,
  computeMeanStepTokens,
  formatFailureStep,
} from './lib/analyze'

export type { RunResult } from './types'
