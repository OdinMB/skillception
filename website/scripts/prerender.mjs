import { createHash } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')

// Import the SSR bundle built by `vite build --ssr`
const ssrPath = pathToFileURL(join(distDir, 'server', 'entry-server.js')).href
const { render, buildPreloadSummary } = await import(ssrPath)

// Read results data
const resultsPath = join(distDir, 'results.json')
const data = JSON.parse(readFileSync(resultsPath, 'utf-8'))

// --- Render full HTML (with complete data for SEO) ---
const appHtml = render(data)

// --- Build summary data using the same logic as the client ---
const summary = buildPreloadSummary(data)

// Write summary as external JS file (loaded via defer before module)
const summaryJs = `window.__PRELOADED_SUMMARY__=${JSON.stringify(summary)};`
writeFileSync(join(distDir, 'summary-data.js'), summaryJs)

// Compute SRI hash for the summary script
const sriHash = 'sha256-' + createHash('sha256').update(summaryJs).digest('base64')

// --- Inject into the built index.html ---
const templatePath = join(distDir, 'index.html')
const template = readFileSync(templatePath, 'utf-8')

// Add defer script for summary data (with SRI integrity) before the module script
const summaryScript = `<script defer src="/summary-data.js" integrity="${sriHash}"></script>`
const output = template
  .replace(/<div id="root"><\/div>/, `<div id="root">${appHtml}</div>`)
  .replace(/<script type="module"/, `${summaryScript}\n    <script type="module"`)

writeFileSync(templatePath, output)

const summarySize = Math.round(summaryJs.length / 1024)
console.log(`Prerendered dist/index.html with ${data.length} runs`)
console.log(`Summary data: ${summarySize}KB (external, SRI: ${sriHash.slice(0, 20)}...), full data: ${Math.round(JSON.stringify(data).length / 1024)}KB (lazy-loaded)`)
