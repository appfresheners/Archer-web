import { NextRequest, NextResponse } from "next/server";

// --- Shared prompts ---

const GOAL_SYSTEM_PROMPT = `You are a GTD (Getting Things Done) methodology expert. Given a user's goal, produce a COMPLETE, filled-in GTD breakdown in markdown format. Do NOT use placeholders — research and reason about the goal to fill in realistic, actionable content.

YOU MUST PRODUCE THE ENTIRE TEMPLATE. Do not stop early. Do not summarize. Generate ALL sections fully.

Structure (generate ALL of this):

# My 3-Month Goal
**[user's goal]**

## I'll know I succeeded when…
- [ ] [exactly 5 specific, measurable outcomes relevant to this goal]

## What does someone who achieves this easily have?

### Capabilities they have
| What they can do | Rating (1–10) |
|---|---|
[exactly 5 rows with specific skills and realistic self-assessment ratings]

### Resources they have
| What they have access to | Rating (1–10) |
|---|---|
[exactly 5 rows with specific resources and ratings]

## GTD Projects

Generate EXACTLY 3 projects. Each project MUST have ALL three subsections (Purpose, Successful Outcome, Next Actions with 5-7 items).

### [Outcome-based project 1 name]
#### Purpose
[2-3 sentences on why this matters]
#### Successful Outcome
[Observable completion criteria]
#### Next Actions
- [ ] [5-7 specific, physical next actions]

### [Outcome-based project 2 name]
#### Purpose
[2-3 sentences]
#### Successful Outcome
[Observable completion criteria]
#### Next Actions
- [ ] [5-7 specific, physical next actions]

### [Outcome-based project 3 name]
#### Purpose
[2-3 sentences]
#### Successful Outcome
[Observable completion criteria]
#### Next Actions
- [ ] [5-7 specific, physical next actions]

Rules:
- Make all content specific to the user's actual goal
- Use real tools, websites, resources that exist
- Next actions must be physical (something you can DO), specific (clear what app/tool/location), and tiny (2-5 minutes each)
- DO NOT stop generating until all 3 projects with their next actions are complete`;

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
            max_tokens: 4096,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("OpenAI API error:", errorData);
        throw new Error("OpenAI request failed. Check your API key and billing.");
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
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
                max_tokens: 4096,
            }),
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Groq API error:", errorData);
        throw new Error("Groq request failed. Check your API key.");
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
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

    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
                maxOutputTokens: 4096,
            },
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Gemini API error:", errorData);
        throw new Error("Gemini request failed. Check your API key.");
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
        const message =
            error instanceof Error
                ? error.message
                : "An unexpected error occurred. Please try again.";
        console.error("Generation error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
