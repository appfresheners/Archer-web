import { escapeMarkdown } from "@/lib/utils/escape-markdown";

/**
 * Generates a GTD Goal Mode markdown template with the user's goal inserted.
 * Pure function: no side effects, deterministic, synchronous.
 *
 * Follows the complete Reverse Goal Setting template structure (Steps 1-6 + Monthly Check).
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

Score each item by how important it is for success.

10 = essential, 5 = useful, 1 = barely relevant

### Capabilities they have

| What they can do | Target rating (1–10) |
| --- | --- |
| [Practical ability related to your goal] |  |
| [Repeatable execution skill] |  |
| [Independent problem-solving in this domain] |  |
| [Consistent habit or routine] |  |

### Resources they have

| What they have access to | Target rating (1–10) |
| --- | --- |
| [Tool, software, or equipment] |  |
| [Knowledge source or learning material] |  |
| [Mentor, community, or support system] |  |

---

## My Current Profile

Use the same items from Target Profile.

Score where I am today.

Gap = Target rating - My rating

### My Capabilities

| What I can do | My rating | Gap |
| --- | --- | --- |
| [Same capability from Target Profile] |  |  |
| [Same capability from Target Profile] |  |  |
| [Same capability from Target Profile] |  |  |
| [Same capability from Target Profile] |  |  |

### My Resources

| What I have | My rating | Gap |
| --- | --- | --- |
| [Same resource from Target Profile] |  |  |
| [Same resource from Target Profile] |  |  |
| [Same resource from Target Profile] |  |  |

---

## What helps and blocks me?

### Drivers (Things that help me)

- [Something already in place that supports this goal]
- [An existing habit, tool, or motivation]
- [Access to useful learning resources]

### Barriers (Things that block me)

- [What gets in the way when the day gets busy]
- [A pattern that has stopped me before]
- [A missing resource or unclear plan]

**If–then plan for the main barrier:**

If *[main barrier situation]*, then I will *[specific alternative action]*.

---

## Focus on 2–3 biggest gaps

Choose the highest gaps from My Current Profile.

### Priority 1

**Gap selected:**

- [Highest gap item from My Current Profile]

**Current:** [my rating]

**Target in 3 months:** [target rating]

**What is stopping this gap from closing?**

- [ ] **Clarity** — I do not know exactly what to do
- [ ] **Consistency** — I know what to do, but I do not repeat it
- [ ] **Access** — I need a tool, resource, person, place, or permission
- [ ] **Feedback** — I need tracking, review, or correction

**Project idea:**

- [What project would close this gap? Describe the finished result.]

**First next action:**

- [ ] [One specific, physical, tiny starter action]

---

### Priority 2

**Gap selected:**

- [Second highest gap item from My Current Profile]

**Current:** [my rating]

**Target in 3 months:** [target rating]

**What is stopping this gap from closing?**

- [ ] **Clarity** — I do not know exactly what to do
- [ ] **Consistency** — I know what to do, but I do not repeat it
- [ ] **Access** — I need a tool, resource, person, place, or permission
- [ ] **Feedback** — I need tracking, review, or correction

**Project idea:**

- [What project would close this gap? Describe the finished result.]

**First next action:**

- [ ] [One specific, physical, tiny starter action]

---

## Link Real Projects

Actual projects live in the **Projects database**.

Use the **🏗️ Projects** relation to link supporting projects to this goal.

Do not duplicate:

- Project tasks
- Full next action lists
- Project status
- Weekly plans

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
