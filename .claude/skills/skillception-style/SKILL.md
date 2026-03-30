---
name: skillception-style
description: >
  Visual identity and style guide for Skillception. Consult this skill BEFORE
  creating any visual or communication assets — images, UI designs, social media
  content, results pages, documentation, or marketing materials for this project.
---

# Skillception Style Kit

Skillception is a humor/experiment repo that tests recursive meta-skill generation in Claude. The visual identity is **Philosophy Department** — a formal academic paper aesthetic applied to deeply unserious content. The contrast between the serious presentation and the absurd subject matter IS the joke.

## Color System

| Role | Hex | Name | Usage |
|------|-----|------|-------|
| Primary | `#2c2c2c` | Ink | Headings, body text, table borders |
| Accent 1 | `#8b0000` | Academic Red | Section numbers, footnote markers, figure labels, fail states, the seal |
| Accent 2 | `#1a5276` | Citation Blue | Links, run IDs, ascent indicators |
| Semantic | `#4a6741` | Pass Green | Pass results, success bars |
| Semantic | `#b8860b` | Warning Amber | Warnings, edge cases |
| Surface 1 | `#fefcf5` | Paper | Page background |
| Surface 2 | `#f5f0e8` | Aged Paper | Abstract blocks, sidebar, code backgrounds |
| Neutral 1 | `#666666` | Footnote | Secondary text, captions |
| Neutral 2 | `#999999` | Caption | Tertiary text, muted labels |
| Neutral 3 | `#d4cfc4` | Rule Line | Horizontal rules, table row borders |

**Color rules:**
- Never use more than Ink + one accent in the same element
- Academic Red is for structural markers (section numbers, figure labels), not decoration
- Charts use only Ink, Academic Red, Citation Blue, and Pass Green — no other colors

## Typography

All fonts are freely available via Google Fonts.

| Role | Family | Weight | Size | Usage |
|------|--------|--------|------|-------|
| Display | Playfair Display | 900 | 42px | "SKILLCEPTION" title only |
| Heading | Playfair Display | 700 | 22–32px | Section headings, article titles |
| Body | Source Serif 4 | 400 | 16px | Paragraph text, descriptions |
| Caption | Source Sans 3 | 400 italic | 12–13px | Figure captions, margin notes |
| Label | Source Sans 3 | 600 | 11px | Table headers, abstract label, section sublabels |
| Code/Data | JetBrains Mono | 400 | 13px | Run IDs, step traces, inline code |

**Typography rules:**
- Headings always have a section number in Academic Red (e.g., "1. Results")
- Body text is justified with auto-hyphens
- Figure captions start with a bold label ("Figure 1:", "Table 1:", "Procedure 1:")

## Tone & Voice

| Trait | This | Not this |
|-------|------|----------|
| Scholarly | Formal academic language applied to absurd content | Actually pretending this is real research |
| Footnoted | Asides and clarifications funnier than the main text | Footnotes that add real information |
| Measured | Careful hedging about silly conclusions | Bold claims about significance |
| Dry | Deadpan delivery — the contrast does the work | Winking at the camera or explaining the joke |

**Writing rules:**
- Write as if this were a peer-reviewed paper in a journal that doesn't exist
- Footnotes carry the best jokes. The main text stays straight-faced
- Results are presented as numbered Figures and Tables with formal captions
- The caption's last sentence can be italic and wry (e.g., *"We counted the 'Creator's three times to be sure."*)
- Self-citation is mandatory. The recursion demands it
- The authors are always "Claude et al." with a footnote clarifying "And also Claude"

## Logo / Seal

The logo is a circular academic seal: `assets/seal.png`

- "DEPT. OF RECURSIVE SKILL STUDIES" around the top arc
- "EST. 2026" along the bottom
- "SKILLCEPTION" on a ribbon banner across the center
- Nested ouroboros snakes (snake eating a snake eating a snake) in the middle
- Dark red (#8b0000) engraving on cream/parchment

**Usage:**
- README: centered at the top, ~200px wide
- Results HTML pages: 80px in the journal header
- Anywhere the project needs a brand mark

## AI Image Generation

### Prompt Fragments

**Base style:** "vintage academic engraving on aged parchment (#fefcf5), dark red (#8b0000) ink, crosshatch line art, formal heraldic style, university seal aesthetic"

**For diagrams/figures:** "minimal ink illustration on cream paper, thin precise lines, labeled with serif captions, looks like a figure from a 19th-century scientific paper"

**For social/banner:** "academic journal header on parchment background, serif typography (Playfair Display), thin horizontal rules, volume and issue numbers, formal but the content is absurd"

### Reference Images

- `assets/academic-logo-v2.png` — pass as `-i` for any branded image generation to maintain the engraving style and seal aesthetic
- `assets/academic-banner.png` — pass as `-i` when generating banner or header images

### Avoid in Prompts

- Modern/flat design — always stay in the engraving/typeset register
- Bright or saturated colors — the palette is ink-on-paper only
- Playful or rounded fonts — everything should feel like it was typeset in the 1800s
- Emoji or informal visual elements

## Page Layout (Results & Web)

Pages are styled as published journal articles:

- Max-width ~720px, centered, Paper background with subtle shadow
- Journal masthead at top: seal, "SKILLCEPTION", "Proceedings of the Dept. of Recursion Studies"
- Article title in Playfair Display 700, subtitle in italic Source Serif
- Abstract in Aged Paper block with Academic Red left border
- Numbered sections ("1. Results", "2. Discussion")
- Charts are CSS-only bar charts using the palette (no chart libraries)
- Tables have 2px Ink top/bottom borders, 1px Rule Line row dividers
- Footnotes collected at page bottom, separated by thin rule

### Results mockup

See `assets/results-mockup.html` for the full reference implementation.

## Themes & Motifs

- Academic paper layout and apparatus (figures, tables, procedures, footnotes)
- "Dept. of Recursion Studies" as the fictional institution
- Bibliography references to nonexistent papers
- Self-citation (the recursion demands it)
- Margin notes with dry commentary
- Formal table styling with proper thead/tbody
- Thin horizontal rules as section dividers

## What to Avoid

- Colorful or modern UI aesthetics — this is a paper, not a dashboard
- Explaining the joke — the humor comes from the contrast between form and content
- Breaking character — maintain the academic voice even in error messages
- Using more than 3 colors in any single visual element
- Sans-serif for body text — Source Serif 4 is the body font, always
- Informal language in figure captions (the italic aside at the end is the only concession)
