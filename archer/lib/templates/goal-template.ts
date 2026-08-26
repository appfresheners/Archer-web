/**
 * Generates a GTD Goal Mode markdown template with the user's goal inserted.
 * Pure function: no side effects, deterministic, synchronous.
 */
export function generateGoalTemplate(input: string): string {
    return `<!-- GTD Goal Mode template scaffold — replace placeholders with your own content -->

# My 3-Month Goal

**${input}**

## I'll know I succeeded when…

- [ ] [Define a specific, measurable outcome]
- [ ] [Define a concrete ability you can demonstrate]
- [ ] [Define an observable result others can verify]
- [ ] [Define a practical achievement, not theoretical knowledge]
- [ ] [Define a completion milestone with a clear deliverable]

## What does someone who achieves this easily have?

### Capabilities they have

| What they can do                                    | Rating (1–10) |
| --------------------------------------------------- | ------------- |
| [Practical ability related to your goal]            |               |
| [Repeatable execution skill]                        |               |
| [Independent problem-solving in this domain]        |               |
| [Consistent habit or routine]                       |               |
| [Communication or teaching ability related to goal] |               |

### Resources they have

| What they have access to                 | Rating (1–10) |
| ---------------------------------------- | ------------- |
| [Tool, software, or equipment]           |               |
| [Knowledge source or learning material]  |               |
| [Environment or workspace]               |               |
| [Mentor, community, or support system]   |               |
| [Time block or energy management system] |               |

## GTD Projects

### [Outcome-based project name: describe the finished result]

#### Purpose

[Why this project matters for achieving your goal]

#### Successful Outcome

[What "done" looks like — clear, observable, completable]

#### Next Actions

- [ ] Open [specific app/tool/browser]
- [ ] Search "[specific search term related to project]"
- [ ] Read the first [specific small portion]
- [ ] Write down [specific small deliverable]
- [ ] Save [with specific name/location]

### [Second outcome-based project name]

#### Purpose

[Why this project matters]

#### Successful Outcome

[What "done" looks like]

#### Next Actions

- [ ] Open [specific app/tool]
- [ ] Create [specific small artifact]
- [ ] Type "[specific content to write]"
- [ ] Save [with specific name/location]
- [ ] Navigate to [next logical location]

### [Third outcome-based project name]

#### Purpose

[Why this project matters]

#### Successful Outcome

[What "done" looks like]

#### Next Actions

- [ ] Open [specific app/tool]
- [ ] Navigate to [specific location]
- [ ] Click [specific button or link]
- [ ] Complete [specific tiny task]
- [ ] Save [specific deliverable]`;
}
