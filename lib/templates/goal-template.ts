import { escapeMarkdown } from "@/lib/utils/escape-markdown";

/**
 * Generates a GTD Goal Mode markdown template with the user's goal inserted.
 * Pure function: no side effects, deterministic, synchronous.
 *
 * Follows the complete Reverse Goal Setting template structure (Steps 1-6 + Monthly Check).
 * The Projects section renders as an HTML accordion (<details>/<summary>).
 */
export function generateGoalTemplate(input: string): string {
    const safeInput = escapeMarkdown(input);
    return `# My 3-Month Goal

By [date], I will have:

**${safeInput}**

## I'll know I succeeded when…

- [ ] [Define a specific, measurable outcome]
- [ ] [Define a concrete ability you can demonstrate]
- [ ] [Define an observable result others can verify]

---

## Target Profile

What does someone who achieves this easily have?

Rate each item by the level you need to reach to succeed at this goal.

10 = near-expert level required, 5 = solid working competence required, 1 = a basic level is enough

### Skills, attributes, and habits they have

| Skill / attribute / habit | Required level (1–10) | What this looks like for this goal |
| --- | --- | --- |
| Time management |  | [e.g. Blocks focused time consistently, rarely misses sessions] |
| Focus and concentration |  | [e.g. Sustains deep work for 60+ min without distraction] |
| Learning ability |  | [e.g. Extracts and applies new concepts quickly] |
| Procrastination resistance |  | [e.g. Starts tasks without needing to feel motivated] |
| Stress management / resilience |  | [e.g. Stays functional under pressure, recovers quickly] |
| [Domain-specific skill for this goal] |  | [What it looks like] |
| [Domain-specific skill for this goal] |  | [What it looks like] |

### Resources they have

| What they have access to | Required level (1–10) |
| --- | --- |
| Time available to invest |  |
| Money / budget available |  |
| Network (people who can help) |  |
| Tools, courses, environments |  |

---

## My Current Profile

Use the same items from Target Profile. Rate yourself honestly today.

Gap = Required level − My rating

### My Skills, Attributes, and Habits

| Skill / attribute / habit | My rating | Gap (required − mine) |
| --- | --- | --- |
| Time management |  |  |
| Focus and concentration |  |  |
| Learning ability |  |  |
| Procrastination resistance |  |  |
| Stress management / resilience |  |  |
| [Domain-specific skill] |  |  |
| [Domain-specific skill] |  |  |

### My Resources

| What I have | My rating | Gap |
| --- | --- | --- |
| Time available to invest |  |  |
| Money / budget available |  |  |
| Network (people who can help) |  |  |
| Tools, courses, environments |  |  |

---

## What helps and blocks me?

### Drivers (Internal strengths)

Things already inside you that help — existing skills, habits, motivation, past experience.

- [An existing skill or habit that supports this goal]
- [A personal strength or past experience that's relevant]
- [Something you're already doing that gives you an advantage]

### Resources (External assets)

Things outside you that you can deploy — time, money, people, tools, courses, access.

- [Time available to invest]
- [Budget, tools, or technology you have access to]
- [People in your network who can help]

### Barriers (Things that block me)

What prevents you from developing the skills and closing the gaps? Think holistically — barriers don't have to be directly about the goal. Anything that stops you from doing the work counts.

- [What gets in the way when the day gets busy]
- [A pattern that has stopped you before]
- [A life factor that limits your available time or energy]

**If–then plan for the main barrier:**

If *[main barrier situation]*, then I will *[specific alternative action]*.

---

## Focus on 2–3 biggest gaps

Look at your Skills, Attributes, and Habits table above. Prioritise items where the **required level is highest** AND the **gap is widest** — these are the most important things to develop and the furthest from where you are. Pick 2–3 only. Do not work on anything else until these improve.

Each priority links to a real project in the Projects section below. That project is where the full next action list lives — not here.

### Priority 1

**Gap selected:**

- [Attribute where required level is highest AND gap is widest]

**Current:** [my rating]

**Target in 3 months:** [target rating]

**What is stopping this gap from closing?**

- [ ] **Clarity** — I do not know exactly what to do
- [ ] **Consistency** — I know what to do, but I do not repeat it
- [ ] **Access** — I need a tool, resource, person, place, or permission
- [ ] **Feedback** — I need tracking, review, or correction

**Linked project:**

→ [Name of the project in the Projects section below that closes this gap]

*(Add the full project with next actions in the Projects section. Link the name here so this priority stays trackable.)*

---

### Priority 2

**Gap selected:**

- [Second highest gap item — required level highest AND gap widest]

**Current:** [my rating]

**Target in 3 months:** [target rating]

**What is stopping this gap from closing?**

- [ ] **Clarity** — I do not know exactly what to do
- [ ] **Consistency** — I know what to do, but I do not repeat it
- [ ] **Access** — I need a tool, resource, person, place, or permission
- [ ] **Feedback** — I need tracking, review, or correction

**Linked project:**

→ [Name of the project in the Projects section below that closes this gap]

*(Add the full project with next actions in the Projects section. Link the name here so this priority stays trackable.)*

---

## Projects

<details>
<summary>[Outcome-based project name — describes the finished result]</summary>

### Purpose

[3–4 sentences on why this project matters for the goal — what completing it enables or changes]

### Successful Outcome

[2–3 sentences describing exactly what "done" looks like in observable, real-world terms. Someone watching should be able to confirm it's complete.]

### Next Actions

- [ ] Open [specific app/tool/browser]
- [ ] Navigate to [specific location or URL]
- [ ] Click [specific button or menu item]
- [ ] Type "[specific text to enter]"
- [ ] Create [specific artifact — file, page, document]
- [ ] Save [with specific name and location]
- [ ] Search "[specific search term]"
- [ ] Read [specific small section or result]
- [ ] Write down [specific small deliverable]
- [ ] Complete [specific tiny verification step]
- [ ] Schedule [specific next session or review]
- [ ] Record [specific note or observation]

</details>

<details>
<summary>[Outcome-based project name — describes the finished result]</summary>

### Purpose

[3–4 sentences on why this project matters for the goal — what completing it enables or changes]

### Successful Outcome

[2–3 sentences describing exactly what "done" looks like in observable, real-world terms. Someone watching should be able to confirm it's complete.]

### Next Actions

- [ ] Open [specific app/tool/browser]
- [ ] Navigate to [specific location or URL]
- [ ] Click [specific button or menu item]
- [ ] Type "[specific text to enter]"
- [ ] Create [specific artifact — file, page, document]
- [ ] Save [with specific name and location]
- [ ] Search "[specific search term]"
- [ ] Read [specific small section or result]
- [ ] Write down [specific small deliverable]
- [ ] Complete [specific tiny verification step]
- [ ] Schedule [specific next session or review]
- [ ] Record [specific note or observation]

</details>

<details>
<summary>[Outcome-based project name — describes the finished result]</summary>

### Purpose

[3–4 sentences on why this project matters for the goal — what completing it enables or changes]

### Successful Outcome

[2–3 sentences describing exactly what "done" looks like in observable, real-world terms. Someone watching should be able to confirm it's complete.]

### Next Actions

- [ ] Open [specific app/tool/browser]
- [ ] Navigate to [specific location or URL]
- [ ] Click [specific button or menu item]
- [ ] Type "[specific text to enter]"
- [ ] Create [specific artifact — file, page, document]
- [ ] Save [with specific name and location]
- [ ] Search "[specific search term]"
- [ ] Read [specific small section or result]
- [ ] Write down [specific small deliverable]
- [ ] Complete [specific tiny verification step]
- [ ] Schedule [specific next session or review]
- [ ] Record [specific note or observation]

</details>

<details>
<summary>[Outcome-based project name — describes the finished result]</summary>

### Purpose

[3–4 sentences on why this project matters for the goal — what completing it enables or changes]

### Successful Outcome

[2–3 sentences describing exactly what "done" looks like in observable, real-world terms. Someone watching should be able to confirm it's complete.]

### Next Actions

- [ ] Open [specific app/tool/browser]
- [ ] Navigate to [specific location or URL]
- [ ] Click [specific button or menu item]
- [ ] Type "[specific text to enter]"
- [ ] Create [specific artifact — file, page, document]
- [ ] Save [with specific name and location]
- [ ] Search "[specific search term]"
- [ ] Read [specific small section or result]
- [ ] Write down [specific small deliverable]
- [ ] Complete [specific tiny verification step]
- [ ] Schedule [specific next session or review]
- [ ] Record [specific note or observation]

</details>

<details>
<summary>[Outcome-based project name — describes the finished result]</summary>

### Purpose

[3–4 sentences on why this project matters for the goal — what completing it enables or changes]

### Successful Outcome

[2–3 sentences describing exactly what "done" looks like in observable, real-world terms. Someone watching should be able to confirm it's complete.]

### Next Actions

- [ ] Open [specific app/tool/browser]
- [ ] Navigate to [specific location or URL]
- [ ] Click [specific button or menu item]
- [ ] Type "[specific text to enter]"
- [ ] Create [specific artifact — file, page, document]
- [ ] Save [with specific name and location]
- [ ] Search "[specific search term]"
- [ ] Read [specific small section or result]
- [ ] Write down [specific small deliverable]
- [ ] Complete [specific tiny verification step]
- [ ] Schedule [specific next session or review]
- [ ] Record [specific note or observation]

</details>

---

## Monthly Goal Check

Use this monthly, not weekly.

1. Is this goal still relevant?
2. Should it be Active, Paused, Not now, Someday, Completed, or Archived?
3. Which linked projects are currently active?
4. Is there a missing project needed to close one of the biggest gaps?
5. What can be paused to reduce overload?
`;
}
