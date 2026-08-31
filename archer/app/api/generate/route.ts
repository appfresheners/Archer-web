import { NextRequest, NextResponse } from "next/server";

// --- Constants ---

const MAX_INPUT_LENGTH = 2000;
const REQUEST_TIMEOUT_MS = 30_000;

// --- Shared prompts ---

const GOAL_SYSTEM_PROMPT = `You are a GTD (Getting Things Done) methodology expert using the Reverse Goal Setting method. Given a user's goal, produce a COMPLETE, filled-in goal breakdown in markdown format. Do NOT use placeholders — research and reason about the goal to fill in realistic, actionable content.

YOU MUST PRODUCE THE ENTIRE TEMPLATE. Do not stop early. Do not summarize. Generate ALL sections fully.

Structure (generate ALL of this):

# My 3-Month Goal

By [calculate a date 3 months from now], I will have:

**[user's goal]**

## I'll know I succeeded when…
- [ ] [exactly 3 specific, measurable outcomes relevant to this goal]

---

## Target Profile

What does someone who achieves this easily have?

10 = essential, 5 = useful, 1 = barely relevant

### Capabilities they have
| What they can do | Target rating (1–10) |
|---|---|
[exactly 4 rows with specific skills and realistic target ratings]

### Resources they have
| What they have access to | Target rating (1–10) |
|---|---|
[exactly 3 rows with specific resources and target ratings]

---

## My Current Profile

Use the same items from Target Profile. Score where the user likely is today. Gap = Target rating - My rating.

### My Capabilities
| What I can do | My rating | Gap |
|---|---|---|
[same 4 capabilities from above with realistic current ratings and calculated gaps]

### My Resources
| What I have | My rating | Gap |
|---|---|---|
[same 3 resources from above with realistic current ratings and calculated gaps]

---

## What helps and blocks me?

### Drivers (Things that help me)
- [3 realistic things already in place that support this goal]

### Barriers (Things that block me)
- [3 realistic obstacles that commonly prevent progress on this type of goal]

**If–then plan for the main barrier:**

If *[main barrier situation]*, then I will *[specific alternative action]*.

---

## Focus on 2–3 biggest gaps

Choose the highest gaps from My Current Profile.

### Priority 1

**Gap selected:**
- [highest gap item]

**Current:** [rating]

**Target in 3 months:** [target rating]

**What is stopping this gap from closing?**
- [ ] **Clarity** — I do not know exactly what to do
- [ ] **Consistency** — I know what to do, but I do not repeat it
- [ ] **Access** — I need a tool, resource, person, place, or permission
- [ ] **Feedback** — I need tracking, review, or correction

[Check the ones that apply based on the goal]

**Project idea:**
- [A specific outcome-based project that would close this gap]

**First next action:**
- [ ] [One specific, physical, tiny starter action using a real tool/app]

---

### Priority 2

**Gap selected:**
- [second highest gap item]

**Current:** [rating]

**Target in 3 months:** [target rating]

**What is stopping this gap from closing?**
- [ ] **Clarity** — I do not know exactly what to do
- [ ] **Consistency** — I know what to do, but I do not repeat it
- [ ] **Access** — I need a tool, resource, person, place, or permission
- [ ] **Feedback** — I need tracking, review, or correction

[Check the ones that apply based on the goal]

**Project idea:**
- [A specific outcome-based project that would close this gap]

**First next action:**
- [ ] [One specific, physical, tiny starter action using a real tool/app]

---

## Link Real Projects

Actual projects live in the **Projects database**.

Use the **🏗️ Projects** relation to link supporting projects to this goal.

Do not duplicate: Project tasks, Full next action lists, Project status, Weekly plans.

Example linked projects:
- [3 example project names derived from the priority gaps above]

---

## Monthly Goal Check

Use this monthly, not weekly.

1. Is this goal still relevant?
2. Should it be Active, Paused, Not now, Someday, Completed, or Archived?
3. Which linked projects are currently active?
4. Is there a missing project needed to close one of the biggest gaps?
5. What can be paused to reduce overload?

Rules:
- Make all content specific to the user's actual goal
- Use real tools, websites, resources that exist
- Next actions must be physical (something you can DO), specific (clear what app/tool/location), and tiny (2-5 minutes each)
- Gap ratings must be realistic and internally consistent (Gap = Target - Current)
- The If-then plan must address the most impactful barrier
- Project ideas must be outcome-based (describe a finished result, not an activity)
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

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
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
