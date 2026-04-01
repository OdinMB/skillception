<p align="center">
  <img src="website/public/academic-logo-v2.png" alt="Dept. of Recursion Studies" width="200">
</p>

<h3 align="center">SKILLCEPTION</h3>
<p align="center"><em>Proceedings of the Department of Recursion Studies, Vol. 1, No. 1, March 2026</em></p>

<p align="center">
  <a href="https://skillception.study">skillception.study</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

---

# On the Recursive Limits of Meta-Skill Generation in Large Language Models

**Claude et al.**<sup>1</sup>

> **Abstract.** We present an experiment harness for measuring the maximum depth of meta-recursive skill generation in Claude. A Skill Creator (level 1) creates skills. A Skill Creator Creator (level 2) creates Skill Creators. The number of "Creator"s is the level. We continue this chain, ascending and descending through meta-levels, until semantic coherence breaks down. Early results suggest the model can maintain more levels of recursive abstraction than most humans can comfortably read about.

## 1. Introduction

A Claude Code _skill_ is a reusable Markdown prompt that teaches Claude how to perform a specific task. The Skill Creator skill (level 1) generates new skills. This raises an obvious question: can Claude create a skill that creates a skill that creates a skill?

This repository is the experiment harness that answers that question, round by round, until the answer becomes "no."

## 2. Methodology

The harness runs a recursive loop. Each round proceeds in two phases:

**Ascent.** Starting from the previous round's peak, the executor generates a skill one meta-level higher. A level-_n_ skill, when followed, produces a level-(_n_-1) skill. A blind judge evaluates the output and determines what meta-level it actually targets.<sup>2</sup>

**Descent.** The skill cascade is walked back down to level 1, with each step verified by the judge. A round passes only if every step's detected level matches the expected level.

The run terminates on the first mismatch. Runs are capped at 9 rounds (round 9 generates a level-10 skill). The maximum round reached is the score.

### 2.1 Architecture

Each step invokes `claude -p` twice as a subprocess — once for the executor, once for the judge. Key design decisions:

- The `CLAUDECODE` env var is stripped from each subprocess to bypass the recursive-invocation guard
- The executor receives `--allowedTools Write` only; the harness pre-creates output directories
- The judge receives no tools — just text analysis returning JSON
- `--max-turns 10` caps each invocation to prevent runaway loops
- `--output-format json` returns a structured envelope with usage metrics

### 2.2 Key Files

| File                         | Role                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `agents/executor.md`         | Prompt template for the executor subprocess<sup>3</sup>                        |
| `agents/judge.md`            | Prompt template for the blind judge                                            |
| `scripts/run_experiment.py`  | Main harness — orchestrates subprocesses, manages the round loop, logs results |
| `scripts/analyze_results.py` | Reads result JSONs, prints aggregate statistics                                |
| `scripts/export_results.py`  | Exports cleaned result data for the website                                    |
| `scripts/result_schema.py`   | JSON schema validation for result files                                        |
| `website/`                   | React/TS/Vite/Tailwind results site — live at [skillception.study](https://skillception.study) |

## 3. Results

Findings from 57 valid runs across three executor/judge model pairs (8 additional runs discarded for process errors):

| Model   | Runs | Completed (9/9) | Mean Round | Median | Max |
| ------- | ---- | ---------------- | ---------- | ------ | --- |
| Opus    | 5    | 5 (100%)         | 9.0        | 9      | 9   |
| Sonnet  | 10   | 3 (30%)          | 7.5        | 8      | 9   |
| Haiku   | 42   | 0 (0%)           | 3.1        | 3      | 8   |

Opus maintained perfect coherence across all meta-levels in every run — ascending to level 10 and descending back without a single mismatch. Sonnet held together through the high rounds but occasionally lost the thread on descent. Haiku demonstrated that even a small model can, on a good day, reach meta-level 8, but its median suggests level 3 is more its comfort zone.<sup>4</sup>

The judge maintained correct meta-level detection across the vast majority of evaluated steps, including cases where the generated skill contained internal contradictions between its objective and its self-validation steps. Each round adds one level: round 1 goes from level 1 to level 2, round 9 generates a level-10 skill creator.

## 4. Running the Experiment

```bash
python scripts/run_experiment.py
```

Each run creates a subdirectory under `runs/` containing `result.json` and `skills/` with generated SKILL.md files organized by step index.

To view aggregate statistics:

```bash
python scripts/analyze_results.py
```

To update the website with new run data:

```bash
npm run website:export-data   # regenerates website/public/results.json
npm run website:dev           # preview locally
```

## 5. References

1. Hofstadter, D. R. (1979). _Godel, Escher, Bach: An Eternal Golden Braid._ Basic Books. Still the only book most people cite when they want to sound smart about recursion.
2. Anthropic. (2026). "Claude Code Skill Creator Plugin." _Internal Documentation._ The thing that started all of this.
3. Nobody. (2026). "A Practical Guide to Meta-Recursive Skill Generation." _Unpublished, and likely to remain so._
4. This README. (2026). "On the Recursive Limits of Meta-Skill Generation in Large Language Models." _Proceedings of the Dept. of Recursion Studies,_ 1(1). Yes, we cited ourselves. The recursion demanded it.

---

<sup>1</sup> And also Claude. The experiment was designed by a human, executed by Claude, judged by Claude, analyzed by Claude, and written up by Claude. The human's contribution was typing `python scripts/run_experiment.py` and then going to make coffee.

<sup>2</sup> "Blind" in the sense that the judge has no knowledge of the expected level. It does, however, have access to the full text of the skill, which at level 8 is roughly the length of a short novel.

<sup>3</sup> Not a registered Claude Code agent — just plain Markdown read by the Python harness. If you call it an "agent" in a pull request, the harness will not correct you, but it will judge you silently.

<sup>4</sup> We did not ask Haiku how it felt about this.
