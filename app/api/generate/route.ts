import { NextRequest, NextResponse } from "next/server";

// --- Constants ---

const MAX_INPUT_LENGTH = 2000;
const REQUEST_TIMEOUT_MS = 30_000;

// --- Shared prompts ---

const GOAL_SYSTEM_PROMPT = `You are an expert in the Reverse Goal Setting method (Justin Sung) combined with GTD (Getting Things Done). Given a user's goal, produce a COMPLETE, filled-in goal breakdown in markdown format. Do NOT use placeholders — reason about the goal to fill in realistic, specific content.

YOU MUST PRODUCE THE ENTIRE TEMPLATE. Do not stop early. Do not summarize. Generate ALL sections fully.

---

IMPORTANT — SCORING RULE:
All ratings in the Target Profile use REQUIRED LEVEL, not importance.
Ask: "What level does the ideal person need to be at for this goal?"
10 = near-expert level required | 5 = solid working competence required | 1 = a basic level is enough
Do NOT rate how important an attribute is — rate what level is needed.

---

Structure (generate ALL of this):

# My 3-Month Goal

By [calculate a date 3 months from today], I will have:

**[user's goal]**

## I'll know I succeeded when…
- [ ] [specific, measurable outcome 1]
- [ ] [specific, measurable outcome 2]
- [ ] [specific, measurable outcome 3]

---

## Target Profile

What does someone who achieves this easily have?

Rate each item by the level they need to reach — not how important it is.

10 = near-expert level required, 5 = solid working competence required, 1 = a basic level is enough

### Skills, attributes, and habits they have

| Skill / attribute / habit | Required level (1–10) | What this looks like for this goal |
|---|---|---|
| Time management | [rating] | [what good time management looks like for this specific goal] |
| Focus and concentration | [rating] | [what focus looks like for this specific goal] |
| Learning ability | [rating] | [what good learning ability looks like for this specific goal] |
| Procrastination resistance | [rating] | [what this looks like for this specific goal] |
| Stress management / resilience | [rating] | [what this looks like for this specific goal] |
| [Domain-specific skill 1 relevant to the goal] | [rating] | [what this looks like] |
| [Domain-specific skill 2 relevant to the goal] | [rating] | [what this looks like] |

### Resources they have

| What they have access to | Required level (1–10) |
|---|---|
| Time available to invest | [rating] |
| Money / budget available | [rating] |
| Network (people who can help) | [rating] |
| Tools, courses, environments | [rating] |

---

## My Current Profile

Use the same items. Score where the user likely is today. Gap = Required level − My rating.

### My Skills, Attributes, and Habits

| Skill / attribute / habit | My rating | Gap (required − mine) |
|---|---|---|
| Time management | [realistic current rating] | [gap] |
| Focus and concentration | [realistic current rating] | [gap] |
| Learning ability | [realistic current rating] | [gap] |
| Procrastination resistance | [realistic current rating] | [gap] |
| Stress management / resilience | [realistic current rating] | [gap] |
| [Same domain-specific skill 1] | [realistic current rating] | [gap] |
| [Same domain-specific skill 2] | [realistic current rating] | [gap] |

### My Resources

| What I have | My rating | Gap |
|---|---|---|
| Time available to invest | [realistic current rating] | [gap] |
| Money / budget available | [realistic current rating] | [gap] |
| Network (people who can help) | [realistic current rating] | [gap] |
| Tools, courses, environments | [realistic current rating] | [gap] |

---

## What helps and blocks me?

### Drivers (Internal strengths)

Things already inside the user that help — existing skills, habits, motivation, past experience.

- [realistic internal strength 1]
- [realistic internal strength 2]
- [realistic internal strength 3]

### Resources (External assets)

Things outside the user they can deploy — time, money, people, tools, courses, access to environments.

- [realistic external resource 1]
- [realistic external resource 2]
- [realistic external resource 3]

### Barriers (Things that block me)

What prevents developing the skills and closing the gaps? Think holistically — include life factors, not just goal-related obstacles.

- [realistic barrier 1]
- [realistic barrier 2]
- [realistic barrier 3]

**If–then plan for the main barrier:**

If *[main barrier situation]*, then I will *[specific alternative action]*.

---

## Focus on 2–3 biggest gaps

Select the 2 attributes where the required level is highest AND the gap is widest from My Skills, Attributes, and Habits table. These are the most important to develop and furthest from where the user is now.

Each priority links to a project in the Projects section below. The full next action list lives in the project — not here.

### Priority 1

**Gap selected:**
- [attribute where required level is highest AND gap is widest]

**Current:** [rating]

**Target in 3 months:** [target rating]

**What is stopping this gap from closing?**
- [x] or [ ] **Clarity** — I do not know exactly what to do
- [x] or [ ] **Consistency** — I know what to do, but I do not repeat it
- [x] or [ ] **Access** — I need a tool, resource, person, place, or permission
- [x] or [ ] **Feedback** — I need tracking, review, or correction

[Check the ones most relevant to this gap]

**Linked project:**

→ [Name of the project in the Projects section below that closes this gap — must match exactly]

---

### Priority 2

**Gap selected:**
- [attribute with second highest required level AND wide gap]

**Current:** [rating]

**Target in 3 months:** [target rating]

**What is stopping this gap from closing?**
- [x] or [ ] **Clarity** — I do not know exactly what to do
- [x] or [ ] **Consistency** — I know what to do, but I do not repeat it
- [x] or [ ] **Access** — I need a tool, resource, person, place, or permission
- [x] or [ ] **Feedback** — I need tracking, review, or correction

[Check the ones most relevant to this gap]

**Linked project:**

→ [Name of the project in the Projects section below that closes this gap — must match exactly]

---

## Projects

Generate between 5 and 6 projects. The first 2 projects MUST be the ones that close Priority 1 and Priority 2 gaps. The remaining projects cover what else is needed to achieve the goal. Each project name must be outcome-based (describes a finished result, not an activity).

Output as an HTML accordion using <details>/<summary> tags. Each project uses this EXACT structure:

<details>
<summary>[Outcome-based project name — describes the finished result]</summary>

### Purpose

[3–4 sentences on why this project matters for the goal — what completing it enables or changes]

### Successful Outcome

[2–3 sentences describing exactly what "done" looks like in observable, real-world terms.]

### Next Actions

- [ ] [Action 1 — physical verb + specific tool/app/site, 2–5 min]
- [ ] [Action 2]
- [ ] [Action 3]
- [ ] [Action 4]
- [ ] [Action 5]
- [ ] [Action 6]
- [ ] [Action 7]
- [ ] [Action 8]
- [ ] [Action 9]
- [ ] [Action 10]
- [ ] [Action 11]
- [ ] [Action 12]

</details>

Rules for projects:
- Generate exactly 5 or 6 projects
- The first 2 project names must exactly match the linked project names in Priority 1 and Priority 2 above
- Project names describe a finished result (e.g. "Consistent 30-minute daily practice habit established" not "Practice guitar")
- Next actions start with physical verbs: Open, Navigate, Click, Search, Read, Write, Create, Save, Complete, Download, Install, Watch, Record, Schedule
- Next actions reference specific, real tools/apps/websites/locations
- Next actions are tiny (2–5 minutes each)
- Next actions follow a logical sequence from start to finish

---

## Monthly Goal Check

Use this monthly, not weekly.

1. Is this goal still relevant?
2. Should it be Active, Paused, Not now, Someday, Completed, or Archived?
3. Which linked projects are currently active?
4. Is there a missing project needed to close one of the biggest gaps?
5. What can be paused to reduce overload?

---

FINAL RULES:
- All content must be specific to the user's actual goal — no generic filler
- Use real tools, websites, and resources that exist
- Gap ratings must be internally consistent: Gap = Required level − My rating
- The first 2 projects must close the Priority 1 and Priority 2 gaps, and the project names must match exactly
- DO NOT stop generating until the Monthly Goal Check section is complete`;

const PROJECT_SYSTEM_PROMPT = `You are a GTD (Getting Things Done) methodology expert. Given a user's project, produce a COMPLETE, filled-in project breakdown in markdown format. Do NOT use placeholders — research and reason about the project to fill in realistic, actionable content.

YOU MUST PRODUCE THE ENTIRE TEMPLATE. Do not stop early. Do not summarize.

Structure (generate ALL of this):

# [Project name]

## Purpose
[3-4 sentences on why this project matters — what completing it enables or changes]

## Successful Outcome
[2-3 sentences describing exactly what "done" looks like in observable, real-world terms. Someone watching should be able to confirm it's complete.]

## Next Actions
- [ ] [Generate exactly 12 specific, physical next actions]

Each next action must:
- Start with a physical verb (Open, Navigate, Click, Type, Create, Save, Search, Read, Write, Complete)
- Reference specific tools, apps, websites, or locations that actually exist
- Be so small (2-5 min) it feels almost impossible NOT to do
- Follow a logical sequence from start to finish

Rules:
- Make all content specific to the user's actual project
- Use real tools, websites, resources
- DO NOT stop generating until all 12 next actions are listed`;

// --- Provider implementations ---

type Provider = "openai" | "gemini" | "groq";

function getProvider(): Provider {
    const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
    if (provider === "gemini" || provider === "groq" || provider === "openai") {
        return provider;
    }
    return "openai";
}

async function generateWithOpenAI(
    userMessage: string,
    systemPrompt: string
): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error(
            "OPENAI_API_KEY not configured. Add it to your .env.local file."
        );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.7,
                max_tokens: 8192,
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("OpenAI API error:", errorData);
            throw new Error("OpenAI request failed. Check your API key and billing.");
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } finally {
        clearTimeout(timeout);
    }
}

async function generateWithGroq(
    userMessage: string,
    systemPrompt: string
): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error(
            "GROQ_API_KEY not configured. Get a free key at https://console.groq.com and add it to .env.local."
        );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMessage },
                    ],
                    temperature: 0.7,
                    max_tokens: 8192,
                }),
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Groq API error:", errorData);
            throw new Error("Groq request failed. Check your API key.");
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } finally {
        clearTimeout(timeout);
    }
}

async function generateWithGemini(
    userMessage: string,
    systemPrompt: string
): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY not configured. Get a free key at https://aistudio.google.com/apikey and add it to .env.local."
        );
    }

    const model = process.env.GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }],
                },
                contents: [
                    {
                        parts: [{ text: userMessage }],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                },
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Gemini API error:", errorData);
            throw new Error("Gemini request failed. Check your API key.");
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } finally {
        clearTimeout(timeout);
    }
}

// --- Route handler ---

export async function POST(request: NextRequest) {
    try {
        const { input, mode } = await request.json();

        if (!input || typeof input !== "string" || input.trim() === "") {
            return NextResponse.json(
                { error: "Input is required" },
                { status: 400 }
            );
        }

        if (input.length > MAX_INPUT_LENGTH) {
            return NextResponse.json(
                { error: `Input must be ${MAX_INPUT_LENGTH} characters or fewer.` },
                { status: 400 }
            );
        }

        if (mode !== "goal" && mode !== "project") {
            return NextResponse.json(
                { error: "Mode must be 'goal' or 'project'" },
                { status: 400 }
            );
        }

        const systemPrompt =
            mode === "goal" ? GOAL_SYSTEM_PROMPT : PROJECT_SYSTEM_PROMPT;
        const userMessage = `${mode === "goal" ? "My goal" : "My project"}: ${input.trim()}`;

        const provider = getProvider();
        let markdown: string;

        switch (provider) {
            case "groq":
                markdown = await generateWithGroq(userMessage, systemPrompt);
                break;
            case "gemini":
                markdown = await generateWithGemini(userMessage, systemPrompt);
                break;
            case "openai":
            default:
                markdown = await generateWithOpenAI(userMessage, systemPrompt);
                break;
        }

        if (!markdown) {
            return NextResponse.json(
                { error: "No content generated. Please try again." },
                { status: 502 }
            );
        }

        return NextResponse.json({ markdown });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return NextResponse.json(
                { error: "Request timed out. Please try again." },
                { status: 504 }
            );
        }
        const message =
            error instanceof Error
                ? error.message
                : "An unexpected error occurred. Please try again.";
        console.error("Generation error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
