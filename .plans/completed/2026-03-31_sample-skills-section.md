# Sample Skills Section

- **Date**: 2026-03-31
- **Status**: draft
- **Type**: feature

## Problem
The website shows statistics about generated skills but never shows an actual SKILL.md. Readers have no way to see what these recursive meta-skills look like in practice, which undercuts the humor and the findings.

## Approach
Add a collapsible "Sample Skills" section (section 3.5, between Resource Consumption and Source Code) with three hardcoded, curated SKILL.md examples — one per model tier. Skill content is stored as static string constants (not fetched from runs/), rendered as a styled `<pre>` block with a copy-to-clipboard button. Three tabs switch between samples. The section is collapsed by default, matching the existing expandable pattern used by run details and token charts.

No markdown rendering library — the SKILL.md files are already readable as plain text with light structural markup (YAML frontmatter, XML tags). A `<pre>` block preserves formatting and is consistent with how academic papers display code/data artifacts.

**Alternatives considered:**
- Adding a markdown renderer (react-markdown + dependencies): heavy for 3 static samples, adds bundle size, introduces a new dependency pattern
- Embedding skill content in results.json: couples curated samples to the export pipeline; these are hand-picked, not computed
- Rendering with custom HTML parsing of the XML tags: over-engineered for plain-text display

## Changes

| File | Change |
|------|--------|
| `website/src/components/SampleSkills.tsx` | New component: three tabs (Opus/Sonnet/Haiku), expandable section, `<pre>` display with copy button. Contains the three hardcoded skill strings as constants. |
| `website/src/App.tsx` | Import `SampleSkills`, render it between the token charts section and the `<hr>` before Source Code. Add section heading "3.5 Sample Skills" (or renumber sections). |

## Sample selection

| Tab | Run | Step | Description |
|-----|-----|------|-------------|
| Haiku | `0ecb17b5` | step-02 | Level 3 ascent (round 2 → target level 3). A "Skill Creator Creator Creator" — the highest meta-level Haiku reliably handles. 140 lines, rich and readable. |
| Sonnet | `38f56e75` | step-36 | First descent in round 8 (level 9 → level 8). A level-8 skill showing the compressed, formulaic pattern at high meta-levels. 57 lines. |
| Opus | `d5dbf37b4cd5` | step-53 | Final descent to level 1 in round 9. A "Skill Creator" — returning to earth after reaching level 10. 83 lines, the clean capstone of a perfect 54-step run. |

## Tests
No new tests needed — this is a static display component with no logic beyond tab switching and clipboard copy, both of which use browser APIs. Existing build/typecheck validates correctness.

## Out of Scope
- Markdown rendering / syntax highlighting
- Dynamic skill loading from results.json or runs/
- Skill content search or filtering
- Adding skill content to the export pipeline
