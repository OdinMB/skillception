import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')

// Import the SSR bundle built by `vite build --ssr`
const ssrPath = pathToFileURL(join(distDir, 'server', 'entry-server.js')).href
const ssr = await import(ssrPath)
const {
  render,
  discardErrorRuns,
  groupByExecutorAndJudge,
  computeStats,
  computeTokensByRound,
  computeMeanStepTokens,
  formatFailureStep,
} = ssr

// Read results data
const resultsPath = join(distDir, 'results.json')
const data = JSON.parse(readFileSync(resultsPath, 'utf-8'))

// --- Render full HTML (with complete data for SEO) ---
const appHtml = render(data)

// --- Compute summary data (stripped steps, pre-computed stats) ---
const MODEL_ORDER = ['opus', 'sonnet', 'haiku']
const MODEL_LABELS = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' }
const JUDGE_ORDER = ['opus', 'sonnet', 'haiku']

const clean = discardErrorRuns(data)
const discarded = data.length - clean.length
const byExecutorAndJudge = groupByExecutorAndJudge(clean)

const summaryModels = []
for (const executorName of MODEL_ORDER) {
  const judgeMap = byExecutorAndJudge.get(executorName)
  if (!judgeMap) continue
  const variants = []
  const judgeNames = [...judgeMap.keys()].sort(
    (a, b) => JUDGE_ORDER.indexOf(a) - JUDGE_ORDER.indexOf(b),
  )
  for (const judgeName of judgeNames) {
    const runs = judgeMap.get(judgeName)
    const stats = computeStats(runs)
    const tokensByRound = computeTokensByRound(runs)

    // Serialize Maps as entries arrays
    const serializedStats = {
      ...stats,
      roundDistribution: [...stats.roundDistribution.entries()],
    }
    const serializedTokens = [...tokensByRound.entries()]

    // Strip steps from runs, add pre-computed fields
    const strippedRuns = runs.map((r) => {
      const stripped = { ...r, steps: [] }
      if (r.failure) {
        stripped._failureDescription = formatFailureStep(r)
      }
      // Pre-compute peak level from steps
      stripped._peakLevel =
        r.steps.length > 0
          ? Math.max(...r.steps.map((s) => s.target_level))
          : 0
      return stripped
    })

    variants.push({
      judgeName,
      judgeLabel: MODEL_LABELS[judgeName] ?? judgeName,
      runs: strippedRuns,
      stats: serializedStats,
      tokensByRound: serializedTokens,
    })
  }
  if (variants.length > 0) {
    summaryModels.push({
      name: executorName,
      label: MODEL_LABELS[executorName] ?? executorName,
      variants,
    })
  }
}

// Pre-compute step token rows (for Table 2)
const byExecutor = new Map()
const byJudge = new Map()
for (const m of summaryModels) {
  for (const v of m.variants) {
    // Use ORIGINAL runs (with steps) for token computation
    const origRuns = byExecutorAndJudge.get(m.name)?.get(v.judgeName) ?? []
    if (!byExecutor.has(m.name)) byExecutor.set(m.name, [])
    byExecutor.get(m.name).push(...origRuns)
    if (!byJudge.has(v.judgeName)) byJudge.set(v.judgeName, [])
    byJudge.get(v.judgeName).push(...origRuns)
  }
}

const stepRows = []
for (const name of MODEL_ORDER) {
  const execRuns = byExecutor.get(name)
  const judgeRuns = byJudge.get(name)
  if (execRuns) {
    const mean = computeMeanStepTokens(execRuns)
    if (mean.stepCount > 0)
      stepRows.push({ role: 'Executor', model: MODEL_LABELS[name] ?? name, tokens: mean.executor })
  }
  if (judgeRuns) {
    const mean = computeMeanStepTokens(judgeRuns)
    if (mean.stepCount > 0)
      stepRows.push({ role: 'Judge', model: MODEL_LABELS[name] ?? name, tokens: mean.judge })
  }
}

const summary = {
  discarded,
  models: summaryModels,
  stepRows,
}

// Write summary as external JS file (loaded via defer before module)
const summaryJs = `window.__PRELOADED_SUMMARY__=${JSON.stringify(summary)};`
writeFileSync(join(distDir, 'summary-data.js'), summaryJs)

// --- Inject into the built index.html ---
const templatePath = join(distDir, 'index.html')
const template = readFileSync(templatePath, 'utf-8')

// Add defer script for summary data before the module script
const summaryScript = '<script defer src="/summary-data.js"></script>'
const output = template
  .replace(/<div id="root"><\/div>/, `<div id="root">${appHtml}</div>`)
  .replace(/<script type="module"/, `${summaryScript}\n    <script type="module"`)

writeFileSync(templatePath, output)

const summarySize = Math.round(summaryJs.length / 1024)
console.log(`Prerendered dist/index.html with ${data.length} runs`)
console.log(`Summary data: ${summarySize}KB (external), full data: ${Math.round(JSON.stringify(data).length / 1024)}KB (lazy-loaded)`)
