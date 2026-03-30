<p align="center">
  <img src="assets/seal.png" alt="Dept. of Recursive Skill Studies" width="200">
</p>

<h3 align="center">SKILLCEPTION</h3>
<p align="center"><em>Proceedings of the Department of Recursive Skill Studies, Vol. 1, No. 1, March 2026</em></p>

---

# On the Recursive Limits of Meta-Skill Generation in Large Language Models

**Claude et al.**<sup>1</sup>

> **Abstract.** We present an experiment harness for measuring the maximum depth of meta-recursive skill generation in Claude. A Skill Creator (level 0) creates skills. A Skill Creator Creator (level 1) creates Skill Creators. We continue this chain, ascending and descending through meta-levels, until semantic coherence breaks down. Early results suggest the model can maintain more levels of recursive abstraction than most humans can comfortably read about.

## 1. Introduction

A Claude Code *skill* is a reusable Markdown prompt that teaches Claude how to perform a specific task. The Skill Creator skill (level 0) generates new skills. This raises an obvious question that nobody asked: can Claude create a skill that creates a skill that creates a skill?

This repository is the experiment harness that answers that question, round by round, until the answer becomes "no."

## 2. Methodology

The harness runs a recursive loop. Each round proceeds in two phases:

**Ascent.** Starting from the previous round's peak, the executor generates a skill one meta-level higher. A level-*n* skill, when followed, produces a level-(*n*-1) skill. A blind judge evaluates the output and determines what meta-level it actually targets.<sup>2</sup>

**Descent.** The skill cascade is walked back down to level 0, with each step verified by the judge. A round passes only if every step's detected level matches the expected level.

The run terminates on the first mismatch. The maximum round reached is the score.

### 2.1 Architecture

Each step invokes `claude -p` twice as a subprocess — once for the executor, once for the judge. Key design decisions:

- The `CLAUDECODE` env var is stripped from each subprocess to bypass the recursive-invocation guard
- The executor receives `--allowedTools Write` only; the harness pre-creates output directories
- The judge receives no tools — just text analysis returning JSON
- `--max-turns 10` caps each invocation to prevent runaway loops
- `--output-format json` returns a structured envelope with usage metrics

### 2.2 Key Files

| File | Role |
|------|------|
| `agents/executor.md` | Prompt template for the executor subprocess<sup>3</sup> |
| `agents/judge.md` | Prompt template for the blind judge |
| `scripts/run_experiment.py` | Main harness — orchestrates subprocesses, manages the round loop, logs results |
| `scripts/analyze_results.py` | Reads result JSONs, prints aggregate statistics |

## 3. Results

Preliminary findings from 2 independent runs:

| Run | Max Round | Steps | Peak Level | Failure Point |
|-----|-----------|-------|------------|---------------|
| `1e5a8c86` | 2 | 9 | 3 | — (clean exit) |
| `d047e34d` | 5 | 31 | 7 | Round 6 descent, executor error |

Run `d047e34d` achieved meta-level 7 — a *Skill Creator Creator Creator Creator Creator Creator Creator Creator* — before the executor process failed during descent at step 30.<sup>4</sup>

The judge maintained correct meta-level detection across all 40 evaluated steps, including cases where the generated skill contained internal contradictions between its objective and its self-validation steps.

## 4. Running the Experiment

```bash
python scripts/run_experiment.py
```

Each run creates a subdirectory under `runs/` containing `result.json` and `skills/` with generated SKILL.md files organized by step index. The `runs/` directory is gitignored.

To view aggregate statistics:

```bash
python scripts/analyze_results.py
```

## 5. References

1. Hofstadter, D. R. (1979). *Godel, Escher, Bach: An Eternal Golden Braid.* Basic Books. Still the only book most people cite when they want to sound smart about recursion.
2. Anthropic. (2026). "Claude Code Skill Creator Plugin." *Internal Documentation.* The thing that started all of this.
3. Nobody. (2026). "A Practical Guide to Meta-Recursive Skill Generation." *Unpublished, and likely to remain so.*
4. This README. (2026). "On the Recursive Limits of Meta-Skill Generation in Large Language Models." *Proceedings of the Dept. of Recursive Skill Studies,* 1(1). Yes, we cited ourselves. The recursion demanded it.

---

<sup>1</sup> And also Claude. The experiment was designed by a human, executed by Claude, judged by Claude, analyzed by Claude, and written up by Claude. The human's contribution was typing `python scripts/run_experiment.py` and then going to make coffee.

<sup>2</sup> "Blind" in the sense that the judge has no knowledge of the expected level. It does, however, have access to the full text of the skill, which at level 7 is roughly the length of a short novel.

<sup>3</sup> Not a registered Claude Code agent — just plain Markdown read by the Python harness. The distinction matters to approximately one person, and that person is the harness.

<sup>4</sup> We counted the "Creator"s three times to be sure.
