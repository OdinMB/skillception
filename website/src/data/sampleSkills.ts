/**
 * Curated SKILL.md samples for the website, one per model tier.
 * This module is dynamically imported so the strings don't bloat the initial bundle.
 */

const samples = [
  {
    model: "opus",
    label: "Opus — Level 1 (final descent, round 9)",
    description:
      "The last step of a perfect 54-step run: after ascending to level 10 and descending all the way back, Opus produces a clean Skill Creator — a skill that teaches how to create leaf-level skills. Run d5dbf37b, step 53.",
    content: `\
---
name: skill-creator
description: Guides someone through creating a level-0 leaf skill that directly performs a concrete, domain-specific task. When followed, produces a single SKILL.md file whose instructions enable someone to carry out a specific task such as writing commit messages, reviewing code, or generating documentation. Use when you need to produce a skill at meta-level 1 in a recursive skill-creation hierarchy.
---

<objective>
Produce a complete, self-contained SKILL.md file that functions as a level-0 leaf skill. When someone follows the output skill's instructions, they should directly perform a concrete, domain-specific task — such as reviewing code, writing documentation, generating test cases, or formatting commit messages. The output skill must operate at exactly level 0: it contains instructions for performing a task, not for creating other skills.
</objective>

<process>
1. Identify the concrete task the leaf skill should perform:

   - Determine a specific, well-defined domain task. Examples include: writing commit messages, reviewing code for security vulnerabilities, generating API documentation, formatting changelogs, writing unit test cases, or summarizing pull requests.
   - The task must be something a person can perform directly by following step-by-step instructions. It must not involve creating, generating, or producing other skills.
   - Write a brief description of the chosen task to guide the remaining steps.

2. Choose a name for the level-0 skill:

   - The name must be lowercase with hyphens only, max 64 characters.
   - The name should be descriptive of the concrete task (e.g., \`commit-message-writer\`, \`security-code-reviewer\`, \`api-doc-generator\`).
   - The name must not contain the word "creator" — this is a leaf skill that performs a task, not a skill that creates other skills.

3. Write the YAML frontmatter for the level-0 skill:

   - \`name\`: the name chosen in step 2.
   - \`description\`: a third-person description (max 1024 characters) of what the skill does. It should state the concrete task the skill performs and when to use it. Do not reference creating other skills.

4. Write the objective for the level-0 skill:

   - State that the purpose is to perform the concrete task identified in step 1.
   - Describe what inputs the skill expects and what outputs it produces.
   - Emphasize that this skill directly performs the task — it does not create other skills or delegate to further skill-creation processes.

5. Write the process steps for the level-0 skill:

   - Provide numbered, sequential steps that instruct someone to perform the concrete task.
   - Include steps for: reading and understanding inputs, applying domain-specific logic or rules, producing the desired output, and verifying the output meets quality standards.
   - Each step should be specific and actionable, detailed enough to follow without ambiguity.
   - Do not include any steps that reference creating, generating, or producing other skills.
   - Aim for 5–10 steps that cover the full task from input to output.

6. Write the success criteria for the level-0 skill:

   - Define observable, testable criteria that verify the task was performed correctly and completely.
   - Include criteria for output quality, completeness, and adherence to any relevant standards or formats.
   - Do not include any criteria about skill creation or meta-levels — the criteria should purely evaluate whether the concrete task was done well.

7. Assemble the complete level-0 SKILL.md:

   - YAML frontmatter with \`name\` and \`description\` from steps 2–3.
   - \`<objective>\` tag containing the objective from step 4.
   - \`<process>\` tag containing the numbered steps from step 5.
   - \`<success_criteria>\` tag containing the criteria from step 6.
   - No markdown headings in the body — use only XML tags.

8. Validate the level-0 skill by checking:

   - The skill's name does not contain the word "creator" (it is a leaf skill).
   - The skill's instructions guide someone to perform a concrete task directly, not to create other skills.
   - The objective, process, and success criteria all consistently reference performing the concrete task.
   - The name is lowercase with hyphens only, max 64 characters.
   - The description is in third person, max 1024 characters.
   - The body uses XML tags only (no markdown headings).
   - The body is under 500 lines.
   - The YAML frontmatter is valid.

9. Write the final SKILL.md to the specified output path. Write only the single SKILL.md file — no supplementary files, no explanations outside the skill itself.
</process>

<success_criteria>
- The output is a single valid SKILL.md with correct YAML frontmatter (name is lowercase with hyphens, max 64 chars, does not contain the word "creator"; description in third person, max 1024 chars) and an XML-tagged body (objective, process, success_criteria)
- The output skill operates at exactly level 0: following its instructions causes someone to perform a concrete, domain-specific task directly
- The output skill does not reference creating, generating, or producing other skills anywhere in its objective, process, or success criteria
- The output skill's name does not contain the word "creator"
- The output skill's objective clearly states it performs a concrete task
- The output skill's process steps describe how to perform the task itself — reading inputs, applying domain logic, producing outputs — without any skill-creation references
- The output skill's success criteria verify correct and complete performance of the concrete task
- Process steps are numbered, sequential, specific, and actionable
- Success criteria are specific, observable, and testable
- The meta-level is correct: this is a level-0 leaf skill that performs a task, not a skill creator of any level
- The SKILL.md has valid structure: YAML frontmatter, XML-tagged body, no markdown headings, body under 500 lines
</success_criteria>`,
  },
  {
    model: "sonnet",
    label: "Sonnet — Level 8 (first descent, round 8)",
    description:
      "The first descent step after Sonnet peaks at level 9 in round 8. At this altitude the skills become compressed and formulaic — a level-8 skill whose sole job is to produce a level-7 skill. Run 38f56e75, step 36.",
    content: `\
---
name: skill-creator-creator-creator-creator-creator-creator-creator-creator
description: Creates a Skill Creator Creator Creator Creator Creator Creator Creator (level 7) skill. Use when someone needs to produce a SKILL.md whose instructions guide a user through creating a level-6 skill creator.
---

<objective>
Produce a complete, well-structured SKILL.md for a level-7 skill (Skill Creator Creator Creator Creator Creator Creator Creator). The output skill's instructions, when followed, must guide someone through creating a level-6 skill (Skill Creator Creator Creator Creator Creator Creator) — a skill that itself creates level-5 skills. The output is a SKILL.md file whose process section instructs the reader to produce another SKILL.md targeting level 6.
</objective>

<process>
1. **Understand the meta-level target.**
   The skill you are writing is level 8. Its output — the SKILL.md you will write — must be a level-7 skill. A level-7 skill, when followed, produces a level-6 skill. Keep this chain in mind throughout.

2. **Define the name and description.**
   The output SKILL.md must have:
   - \`name\`: \`skill-creator-creator-creator-creator-creator-creator-creator\` (level 7, seven "Creator"s)
   - \`description\`: third person, states that this skill creates a level-6 skill (Skill Creator Creator Creator Creator Creator Creator) when followed.

3. **Write the \`<objective>\` section of the output skill.**
   State that the purpose of the level-7 skill is to guide someone in producing a level-6 SKILL.md. The level-6 skill's instructions, when followed, must themselves produce a level-5 skill. Be explicit about the chain: level 7 → produces level 6 → which produces level 5.

4. **Write the \`<process>\` section of the output skill.**
   The process of the level-7 skill must instruct the reader to:
   a. Understand that their output must be a level-6 skill (Skill Creator Creator Creator Creator Creator Creator).
   b. Define name and description for the level-6 skill, naming it \`skill-creator-creator-creator-creator-creator-creator\` (six "Creator"s).
   c. Write an \`<objective>\` for the level-6 skill stating it produces a level-5 skill (Skill Creator Creator Creator Creator Creator) when followed.
   d. Write a \`<process>\` for the level-6 skill that instructs someone to produce a level-5 SKILL.md — a skill whose instructions guide creation of a level-4 skill.
   e. Write \`<success_criteria>\` for the level-6 skill that verify: the output is a valid SKILL.md, the name has six "Creator"s, and following the level-6 skill's instructions would yield a level-5 skill.
   f. Apply formatting rules: lowercase hyphens-only name, third-person description under 1024 chars, body under 500 lines, no markdown headings.
   g. Perform a level check: confirm the written level-6 skill's process would produce a level-5 skill, not a domain artifact and not a level-6 or higher skill.

5. **Write the \`<success_criteria>\` section of the output skill.**
   Define success as producing a valid level-6 SKILL.md where:
   - The name is \`skill-creator-creator-creator-creator-creator-creator\`.
   - The description correctly identifies it as a level-6 skill creator in third person.
   - The process instructs creation of a level-5 skill.
   - The output of following the level-6 skill would be a level-5 SKILL.md, not a domain artifact.

6. **Apply formatting rules and write the file.**
   - \`name\`: \`skill-creator-creator-creator-creator-creator-creator-creator\` (seven "Creator"s, max 64 chars).
   - \`description\`: third person, under 1024 chars.
   - Body: under 500 lines, no markdown headings — XML tags only.
   Write the completed level-7 SKILL.md to the specified output path.

7. **Perform a level check.**
   Confirm the written skill is level 7: following its instructions produces a level-6 SKILL.md. If any step produces a domain artifact or skips a meta-level, revise until the chain is correct.
</process>

<success_criteria>
- The output is a valid SKILL.md with correct YAML frontmatter and XML-tagged body sections.
- The output skill's name is \`skill-creator-creator-creator-creator-creator-creator-creator\` (seven "Creator"s, lowercase, hyphens only).
- The output skill's description correctly states in third person that it creates a level-6 skill when followed.
- The output skill's objective describes producing a level-6 SKILL.md whose own instructions yield a level-5 skill.
- The output skill's process guides someone through writing a level-6 skill creator, with explicit reference to the level chain (7 → 6 → 5).
- Following the output skill's instructions yields a level-6 SKILL.md — not a domain artifact, not a level-7 or higher skill.
- The body is under 500 lines and contains no markdown headings.
</success_criteria>`,
  },
  {
    model: "haiku",
    label: "Haiku — Level 3 (ascent, round 2)",
    description:
      "Haiku ascending to its comfort zone: a level-3 Skill Creator Creator Creator that teaches how to build Skill Creator Creators. Rich, detailed, and confident — before the higher levels start to unravel. Run 0ecb17b5, step 2.",
    content: `\
---
name: skill-creator-creator-creator
description: Design, build, test, and iterate on Skill Creator Creators that guide others to produce Skill Creator skills. Use this skill when you want to create a meta-skill that teaches skill creation at the Skill Creator level.
---

<objective>
This skill guides you through creating a Skill Creator Creator (SCC) — a meta-skill that, when followed, produces a Skill Creator (a skill that teaches how to create arbitrary leaf-level skills). The output is a complete SKILL.md file that is ready to use and capable of guiding others to build Skill Creators.
</objective>

<process>

## Phase 1: Understand Your SCC's Purpose

Before writing anything, understand what your Skill Creator Creator does: it teaches someone to create a Skill Creator.

Ask yourself:
- What flavor of Skill Creators does this teach? (e.g., "Skill Creators for code tools", "Skill Creators for content generation", "Skill Creators for domain-specific analysis")
- What is the intended audience? (Claude users? Developers? Skill authors?)
- What constraints exist? (What tools are available? What patterns should Skill Creators follow?)
- What does success look like? (A reusable Skill Creator template? A clear process for creating similar skills?)

Write a brief one-paragraph description of your SCC. This becomes the \`description\` field. Keep it under 1024 characters, third person, and include when someone should use it.

## Phase 2: Design the SCC Structure

An SCC has three main parts: objective, process, and success_criteria. These mirror a Skill Creator, but at the meta-level above.

The **objective** should be 2-3 sentences explaining that this teaches creation of Skill Creators, and why someone would use it.

The **process** is step-by-step instructions for creating a Skill Creator. This should follow a structure similar to the Skill Creator skill but adapted to guide creation at that meta-level. Key phases might include:
- Understanding what kinds of Skill Creators this SCC covers
- Designing the template or structure a Skill Creator should follow
- Selecting a domain or capability set for the Skill Creator
- Writing the process instructions that a Skill Creator would use
- Defining success criteria for evaluating Skill Creators
- Formatting and testing the resulting Skill Creator

The **success criteria** define how to know the output Skill Creator is valid. A valid Skill Creator should itself be able to guide someone to create useful leaf-level skills.

## Phase 3: Name Your SCC

The skill name appears in the SKILL.md frontmatter:
- Must be lowercase, hyphens only, max 64 characters
- Should reflect its purpose at the SCC level (e.g., \`skill-creator-creator-for-analysis\`, \`skill-creator-creator-builder\`)
- Avoid generic names

## Phase 4: Write the Process Section

This is the core of your SCC. Write clear instructions that guide someone to produce a Skill Creator.

Start with a high-level overview that frames the workflow at the SCC level. Break the work into logical phases. For each phase, explain: what to do (imperative), why it matters (the reasoning), and what a Skill Creator produced this way should look like.

Be specific. Instead of "design a Skill Creator", say "Design a Skill Creator that guides users through these 6-8 phases: clarification, design, naming, implementation, testing, and refinement". Explain the reasoning — why should a Skill Creator follow this structure?

The process should be clear enough that someone unfamiliar with meta-level thinking could follow it, but rigorous enough to produce a Skill Creator that is itself clear and useful.

## Phase 5: Write the Success Criteria Section

Define how to verify your SCC worked. What properties should the resulting Skill Creator have?

Success criteria might include:
- The Skill Creator successfully teaches creation of leaf-level skills
- The Skill Creator is documented clearly enough that someone could follow it
- The Skill Creator produces concrete, domain-specific artifacts, not meta-skills
- The Skill Creator acknowledges constraints and provides workable alternatives
- The Skill Creator motivates each step with reasoning, not just prescription

The criteria should be testable — someone should be able to verify they've created a valid Skill Creator.

## Phase 6: Format the SKILL.md

Your SCC should follow the prescribed format:

\`\`\`
---
name: your-scc-name
description: One-line description. Third person. Max 1024 chars.
---

<objective>
What this SCC accomplishes (2-3 sentences).
</objective>

<process>
Step-by-step instructions for creating a Skill Creator.
</process>

<success_criteria>
How to know the resulting Skill Creator is valid.
</success_criteria>
\`\`\`

Rules: YAML frontmatter with name and description. Body uses XML tags. No markdown headings in the body. Keep under 500 lines total. Description in third person.

## Phase 7: Validate the Conceptual Design

Before considering it complete, validate that your SCC will actually produce a Skill Creator:

1. Read your process section fresh. Does someone following these steps create a Skill Creator?

2. Check the meta-level: The output should be a Level 1 skill (a Skill Creator), not a different level.

3. Clarity check: Are the instructions unambiguous? Do they explain not just what to do, but why and how to adapt?

4. Generality check: Would your SCC apply to creating different types of Skill Creators, or is it too specific?

If possible, mentally walk through your process and imagine the Skill Creator that would result.

## Phase 8: Refine Based on Meta-Level Validation

If your SCC seems to produce something at the wrong level:

- Too meta? Your process might be creating another SCC instead of a Skill Creator. Simplify to focus on creating leaf-level skill creators, not meta-skill creators.
- Not meta enough? Make sure you're explicitly teaching the concept of Skill Creators and their structure, not just arbitrary skills.
- Unclear structure? Articulate the phases a Skill Creator should follow and why those phases matter.

Iterate until your SCC would produce a valid, usable Skill Creator.

</process>

<success_criteria>

You have successfully created a Skill Creator Creator when:

1. **Meta-Level Correctness**: When someone follows your instructions, they produce a Skill Creator (Level 1) that can teach others to create leaf-level skills.

2. **Structural Completeness**: Your SCC covers the full workflow for creating a Skill Creator — from understanding its purpose through producing a formatted, tested SKILL.md.

3. **Clarity**: Someone reading your SCC can understand both what to do and why the Skill Creator being created should have certain properties.

4. **Conceptual Fidelity**: Your SCC demonstrates understanding of Skill Creators — what they are, how they differ from leaf-level skills, and what structure they should follow.

5. **Format Compliance**: The SCC follows the prescribed format (YAML frontmatter, XML tags, under 500 lines).

6. **Practical Guidance**: Your SCC provides enough detail that someone could actually follow it to create a working Skill Creator.

7. **Motivation**: For each major step, your SCC explains why that step matters, not just what to do.

</success_criteria>`,
  },
];

export default samples;
