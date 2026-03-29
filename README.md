# Skillception

The skill-creator is meta. Meta is good. More meta is better.

So naturally we asked: what if we made the skill-creator create a skill-creator-creator? And then had _that_ create a skill-creator? And then had _that_ create a skill-creator-creator-creator? And then—

You get the idea. We didn't stop. We _automated_ not stopping.

## The premise

Claude Code has a skill that creates skills. That's already one level of meta. But one level of meta is for cowards. What we want to know is: **how deep can we go before Claude loses the plot?**

```
Level 0: Skill Creator                         — creates skills
Level 1: Skill Creator Creator                  — creates things that create skills
Level 2: Skill Creator Creator Creator          — creates things that create things that create skills
Level 3: Skill Creator Creator Creator Creator  — you are here and already confused
Level N: Skill Creator^(N+1)                    — creates level-(N-1) skills. allegedly.
```

## What actually happens

Each run climbs to a new meta-level and then tries to climb back down, like an existential game of Chutes and Ladders:

**Round 0:** The skill-creator creates a Skill Creator Creator. Then the Skill Creator Creator creates a Skill Creator. Simple enough. Two steps. Both Claudes nod sagely.

**Round 1:** The new Skill Creator creates a Skill Creator Creator Creator. Then that cascades back down: SCCC makes an SCC, SCC makes an SC. Three steps. Things are still basically fine.

**Round 2:** The Skill Creator creates a Skill Creator Creator Creator Creator. Then SCCCC makes an SCCC, which makes an SCC, which makes an SC. Four steps. The word "Creator" has lost all meaning.

**Round N:** One ascent step + N+1 descent steps. Each step is a separate Claude session that has to correctly understand what "a skill that creates skills that create skills that create skills that create skills" means. The error compounds like a game of telephone played by philosophy grad students.

## The twist: blind judging

To keep this rigorous (as rigorous as a joke experiment deserves), a second Claude — the **judge** — evaluates each generated skill _blind_. It gets the SKILL.md with no context about what level it's supposed to be, and has to figure out the meta-level independently. If the judge disagrees with the expected level, the run fails.

This means the experiment can't cheat its way to higher rounds. Every step is independently verified by a Claude that has no idea what's going on. Just like the rest of us.

## Running the experiment

```bash
# One run. Watch it climb and fall.
python scripts/run_experiment.py

# The full scientific experience: 100 runs, then stare at the wreckage.
python scripts/run_experiment.py --runs 100
python scripts/analyze_results.py

# "What if I only want 3 rounds of existential recursion?"
python scripts/run_experiment.py --max-rounds 3
```

## What you get

Each run saves a JSON trace to `results/` with every step: what was expected, what the judge detected, and the judge's reasoning (often entertaining in its own right).

The analysis script gives you the numbers:

- Distribution of how far runs got before failing
- Whether ascent or descent is harder (spoiler: probably descent)
- Which meta-level is the breaking point
- The specific mismatches: "expected level 3, got level 2" tells you where the semantic compression fails

## The files

```
skillception/
├── agents/
│   ├── executor.md          # "Here is a skill. Now create a skill that creates that kind of skill."
│   └── judge.md             # "What level of meta is this? Just a number, please."
├── scripts/
│   ├── run_experiment.py    # The machine that goes ping
│   └── analyze_results.py   # The machine that counts the pings
├── results/                 # [gitignored] The pings themselves
└── generated-skills/        # [gitignored] A graveyard of increasingly confused SKILL.md files
```

## Requirements

- Claude Code CLI (`claude`) on PATH
- Python 3.10+
- The skill-creator plugin installed (`~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/`)
- A willingness to spend API credits on philosophical humor
