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

export { buildPreloadSummary } from './lib/preload'

export type { RunResult } from './types'
