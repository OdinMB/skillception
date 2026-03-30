# Deploying the Website on Render (Static Site)

## Overview

The Skillception results website is a Vite/React static site in the `website/` directory. It fetches `results.json` at runtime from the same origin — no API server needed. Render hosts it as a **Static Site** service.

The key complication: `runs/` is gitignored, so the build can't generate `results.json` on Render from raw data. Instead, `website/public/results.json` must be committed to the repo (or the `runs/` directory must be made available to the build).

## Option A: Commit results.json (Recommended)

The simplest approach. Generate `results.json` locally and commit it.

### One-time setup

1. Generate the data file locally:

   ```bash
   python scripts/export_results.py
   ```

   This writes `website/public/results.json`.

2. Remove `website/public/results.json` from `.gitignore` (it's currently listed there).

3. Commit `website/public/results.json` to the repo.

4. On [Render Dashboard](https://dashboard.render.com), create a new **Static Site** with these settings:

   | Setting              | Value                      |
   |----------------------|----------------------------|
   | **Repository**       | Your GitHub/GitLab repo    |
   | **Branch**           | `main`                     |
   | **Root Directory**   | `website`                  |
   | **Build Command**    | `npm install && npm run build` |
   | **Publish Directory** | `dist`                    |

5. No environment variables are needed.

### Updating results

After running new experiments:

```bash
python scripts/export_results.py
git add website/public/results.json
git commit -m "Update results data"
git push
```

Render auto-deploys on push to `main`.

## Option B: Include runs/ in the repo

If you want the build to generate `results.json` on Render:

1. Remove `runs/` from `.gitignore` and commit the `runs/` directory.

2. On Render, set the **Root Directory** to the repo root (leave blank), and use this build command:

   ```bash
   python scripts/export_results.py && cd website && npm install && npm run build
   ```

   Set **Publish Directory** to `website/dist`.

3. This requires Python to be available in the Render build environment. Render's static site build image includes Python 3 by default, so this works without extra configuration.

## Render configuration file (optional)

Instead of configuring via the dashboard, you can add a `render.yaml` at the repo root:

```yaml
services:
  - type: web
    name: skillception
    runtime: static
    rootDir: website
    buildCommand: npm install && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

The `rewrite` route ensures client-side routing works if you add it later. For a single-page app with no router, it's optional but harmless.

## Custom domain

After the site deploys:

1. Go to the service's **Settings > Custom Domains** on Render.
2. Add your domain and follow the DNS instructions (CNAME to `*.onrender.com`).
3. Render provisions a TLS certificate automatically.

## Build details

- **Node version**: Render uses the version specified in `.nvmrc` or `package.json` `engines` field. The site works with Node 18+. If you need to pin it, add a `website/.nvmrc` containing `20`.
- **Build output**: Vite produces `website/dist/` with `index.html`, hashed JS/CSS bundles, and `public/` assets (the logo PNG and, if committed, `results.json`).
- **Cache**: Render caches `node_modules` between builds. A `package-lock.json` is already committed, so installs are deterministic.

## Verifying locally

To preview the production build before deploying:

```bash
cd website
npm run build
npm run preview
```

This serves `dist/` on `http://localhost:4173`.
