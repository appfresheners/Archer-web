---
title: "Archer - Product Brief"
status: superseded
created: 2026-08-20
updated: 2026-09-27
---

> **SUPERSEDED (2026-09-27).** This brief describes the original static-export MVP (no accounts, copy/download, Notion-optimized markdown for paste-out). The current product (v1-full) is authenticated, Supabase-backed, and AI-generated: generation returns **structured JSON persisted as structured Supabase rows** — there is no markdown output, no copy/download, and Archer (not Notion) is the system of record. See `epics.md`, `ARCHITECTURE-SPINE.md`, and the UX `EXPERIENCE.md` for the authoritative current scope. The text below is retained for historical context only.

# Product Brief: Archer

## Executive Summary

Archer is a free, public web app that transforms a goal or project name into a structured GTD (Getting Things Done) breakdown — outcome-based projects, success criteria, and micro next actions — ready to paste into Notion or any markdown-based system.

The premise is simple: most people know _what_ they want to achieve but freeze when they try to figure out _what to do next_. Archer removes that friction. You type a goal or project, and you get back a properly structured template with your input slotted in, formatted for immediate use in your productivity system.

This is a passion project with a clear thesis: if people can get unstuck faster, they're more productive. More productivity ripples into a better economy and a better society. No accounts, no paywalls, no tracking. Just the tool.

## The Problem

People set goals and then stall. The gap between "I want to learn guitar" and "what do I physically do right now" is where motivation dies. GTD solves this conceptually — define the outcome, break it into projects, identify the very next physical action — but most people don't know how to apply it, and doing it from scratch every time is its own form of friction.

Existing options are either:

- Full GTD apps (Todoist, Things, OmniFocus) that assume you already know how to think in GTD
- ChatGPT/Claude where you have to craft the right prompt and get inconsistent structure
- Templates that sit empty because filling them in _is_ the hard part

The gap: nobody gives you a structured GTD template _with your specific goal already framed inside it_, ready to use.

## The Solution

A single-page web app with two modes:

**Goal Mode** — for when you have a big ambition (e.g., "Become a proficient guitarist in 3 months"). Produces the full pipeline:

- 3-month goal definition with measurable success criteria
- Capability analysis (what someone who achieves this has)
- Resource analysis (what they have access to)
- GTD outcome-based projects derived from the goal
- Micro next actions for each project (physical, visible, immediately executable)

**Project Mode** — for when you already know the project (e.g., "Personal portfolio website deployed online"). Produces:

- Project purpose
- Successful outcome description
- Complete set of micro next actions in logical order

Output is Notion-optimized markdown. One click to copy, one click to download as `.md`. Paste into Notion and every header, checkbox, and table renders natively.

## What Makes This Different

- **Zero friction** — no account, no setup, no prompt engineering. One input field, one button.
- **Notion-native output** — the markdown is structured specifically to render perfectly in Notion (headers, checkboxes, tables).
- **GTD methodology built in** — the templates encode David Allen's methodology so users don't need to understand GTD to benefit from it. The structure does the thinking.
- **Free forever** — no premium tier, no usage limits, no ads. Public good.

## Who This Serves

**Primary:** People who set goals but struggle to start. They might use Notion or similar tools for organization but freeze at the "blank page" moment. They don't need motivation — they need the _next physical action_ spelled out.

**Secondary:** GTD practitioners who want a quick way to scaffold new projects without manually building the template structure every time.

## Success Criteria

- A user can go from landing page to copied markdown in under 30 seconds
- The markdown pastes cleanly into Notion with correct formatting (headers, checkboxes, tables)
- The app loads fast and works on mobile
- Zero operational cost (static deployment, no backend services)

## Scope

**MVP1 (now):**

- Landing page with Goal/Project mode selection
- Single text input per mode
- Template generation (no AI — structural template with user input inserted)
- Copy to clipboard button
- Download as .md button
- Responsive design
- Deployed to Vercel

**Explicitly out:**

- User accounts or saved history
- AI/LLM-powered generation (future enhancement)
- Notion API integration (users copy/paste instead)
- Analytics or tracking
- Monetization of any kind

## Vision

If Archer proves useful in its template form, the natural evolution is adding an AI layer that generates _personalized_ GTD breakdowns — real capability analysis, tailored next actions based on the user's situation, context-aware project suggestions. The templates become the structure; AI fills them with intelligence.

But that's later. MVP1 proves the interaction model: can people go from "I have a goal" to "I know exactly what to do next" in 30 seconds? If yes, everything else follows.
