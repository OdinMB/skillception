# SEO: Prerendering, Meta Tags, and OG Image

- **Date**: 2026-03-31
- **Status**: done
- **Type**: feature

## Problem

The website at skillception.study is a client-side SPA with zero SEO infrastructure — no meta description, no OG tags, no Twitter cards, and an empty `<div id="root">` until JS executes. Social link previews show nothing, and search engines see a blank page until they render JS.

## Approach

Three layers, in order of impact:

1. **Static meta/OG tags** in `index.html` — zero dependencies, covers social sharing
2. **OG image** — static 1200×630 asset in `public/`, academic journal style
3. **Build-time prerender** — render React to static HTML during `vite build` so crawlers see real content without JS

For prerendering, use `vite-plugin-ssr-prerender` or a simple postbuild script with `ReactDOMServer.renderToString()`. Since this is a single-route SPA, a lightweight postbuild script is simpler than a full SSG framework.

### Decision: Prerendering scope

**Option A — Meta tags only (no prerender):** Static meta/OG tags in `index.html`. Google already renders JS SPAs. Social crawlers only read `<meta>` tags. Simplest possible change.

**Option B — Meta tags + light prerender:** After `vite build`, run a Node script that imports the React app, renders it to HTML with `ReactDOMServer`, and injects the result into `dist/index.html`. Crawlers see full content. Adds a build step but no runtime deps.

**Recommendation:** Option B — the prerender script is ~30 lines and gives genuine SEO value (content in HTML, better Core Web Vitals, faster indexing).

## Changes

| File | Change |
|------|--------|
| `website/index.html` | Add `<meta name="description">`, `<link rel="canonical">`, `og:*` tags, `twitter:*` tags. Update `<title>` to include article title. |
| `website/public/og-image.png` | New file: 1200×630 OG image in academic journal style |
| `website/scripts/prerender.ts` | New file: postbuild script that renders React app to static HTML and injects into `dist/index.html` |
| `website/package.json` | Add `"postbuild"` script, add `tsx` devDep for running the prerender script |
| `website/vite.config.ts` | No changes needed |

## Prerender Script Design

```
1. Import the App component
2. Call ReactDOMServer.renderToString(<App />)
3. Read dist/index.html
4. Replace <div id="root"></div> with <div id="root">{html}</div>
5. Write back to dist/index.html
```

React's `hydrateRoot` in `main.tsx` will pick up the pre-rendered HTML client-side without a full re-render. Need to switch from `createRoot` to `hydrateRoot`.

Challenge: App fetches `results.json` in useEffect. The prerender needs to either:
- Provide the data via a mock/static import during SSR
- Or accept that the prerendered HTML shows the loading state

Simplest: read `public/results.json` and pass it as initial data to avoid the fetch during SSR.

## Meta Tags Content

```
title: "Skillception — On the Recursive Limits of Meta-Skill Generation"
description: "How many times can you say 'Creator' before Claude loses the thread? A rigorous investigation across 100+ experiment runs."
og:title: "On the Recursive Limits of Meta-Skill Generation in Large Language Models"
og:description: "How many times can you say 'Creator' before Claude loses the thread entirely? Across 100+ runs, we test how long Claude maintains semantic coherence across ascending and descending meta-levels."
og:image: https://skillception.study/og-image.png (1200×630)
og:type: article
og:url: https://skillception.study
twitter:card: summary_large_image
canonical: https://skillception.study
```

## OG Image Design

1200×630, following the style kit:
- Parchment background (#fefcf5)
- Academic seal (academic-logo-v2.png) centered or left-positioned
- Title in Playfair Display
- Subtitle in italic Source Serif
- "Proceedings of the Dept. of Recursion Studies · skillception.study" footer
- Dark red (#8b0000) accents, engraving aesthetic

## Tests

- `npm run website:build` succeeds and `dist/index.html` contains rendered content (not empty `<div id="root">`)
- `dist/og-image.png` exists
- Meta tags present in `dist/index.html`
- Site still works client-side (hydration succeeds without errors)

## Out of Scope

- Sitemap.xml generation
- robots.txt
- Structured data / JSON-LD
- Multi-route prerendering (single page only)
- Dynamic OG images per run
