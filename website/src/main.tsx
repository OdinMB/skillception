import { StrictMode } from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import type { PreloadedSummary } from './App.tsx'

const rootEl = document.getElementById('root')!
const preloadedSummary = (window as unknown as Record<string, unknown>).__PRELOADED_SUMMARY__ as
  | PreloadedSummary
  | undefined
const preloadedData = (window as unknown as Record<string, unknown>).__PRELOADED_DATA__ as
  | import('./types').RunResult[]
  | undefined

if (rootEl.childNodes.length > 0) {
  hydrateRoot(
    rootEl,
    <StrictMode>
      <App initialData={preloadedData} preloadedSummary={preloadedSummary} />
    </StrictMode>,
  )
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App initialData={preloadedData} preloadedSummary={preloadedSummary} />
    </StrictMode>,
  )
}
