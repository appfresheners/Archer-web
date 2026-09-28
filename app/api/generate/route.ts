/**
 * Single generation endpoint (Pattern A).
 *
 * This is the ONE authenticated route that every generation flow shares:
 *   1. Auth guard — reject any request without a valid Supabase session with
 *      401 *before* any provider call is made.
 *   2. Validation — parse the discriminated body `{ mode, input, depth }` and
 *      reject empty/whitespace, over-cap (>2000 chars), unknown modes, and
 *      (for `project`) a missing/invalid `depth`, all with 400 before the
 *      provider call.
 *   3. Dispatch — select the depth-aware system prompt and route the
 *      recognized mode through `generate()` from `lib/ai`, which owns provider
 *      selection and the 30-second timeout.
 *   4. Save-before-return — on success, parse the breakdown and write ONE
 *      `projects` row owned by the signed-in user (with the chosen
 *      `planning_depth`, `goal_id = null`, the full `breakdown_md`, and the
 *      parsed `name`/`purpose`/`successful_outcome`), then return `{ id }`.
 *      An insert failure maps to 500 and the client never navigates.
 *
 * Epic 3 adds Patterns B/C (goal framework / goal generate) by adding a branch
 * to the `switch (mode)` below — reusing this same auth check, provider path,
 * and timeout handler. It never introduces a second endpoint, inline provider
 * fetch code, or hardcoded model strings.
 */

import { generate } from "@/lib/ai";
import {
    PROJECT_FULL_GTD_SYSTEM_PROMPT,
    PROJECT_MINIMAL_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { parseProjectBreakdown } from "@/lib/projects/parse-breakdown";
import type { PlanningDepth, ProjectInsert } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** Hard server-side safety cap. Longer input is rejected before the AI call. */
const MAX_INPUT_LENGTH = 2000;

/** Modes wired on this route today. Epic 3 extends this union. */
const KNOWN_MODES = ["project"] as const;
type Mode = (typeof KNOWN_MODES)[number];

/** Valid `planning_depth` values accepted for a project request. */
const KNOWN_DEPTHS = ["minimal", "full_gtd"] as const;

function isKnownMode(value: unknown): value is Mode {
    return (
        typeof value === "string" && (KNOWN_MODES as readonly string[]).includes(value)
    );
}

function isKnownDepth(value: unknown): value is PlanningDepth {
    return (
        typeof value === "string" &&
        (KNOWN_DEPTHS as readonly string[]).includes(value)
    );
}

/** Depth → system prompt. Keeps the depth→prompt seam explicit and testable. */
const PROMPT_BY_DEPTH: Record<PlanningDepth, string> = {
    minimal: PROJECT_MINIMAL_SYSTEM_PROMPT,
    full_gtd: PROJECT_FULL_GTD_SYSTEM_PROMPT,
};

/**
 * Read the authenticated user via the server Supabase client.
 *
 * Mirrors `app/app/layout.tsx`: the Supabase call is isolated in its own
 * try/catch so a transient failure reaching Supabase is treated as
 * unauthenticated rather than surfacing an unhandled error. Returns `null`
 * when there is no user OR any error occurs.
 */
async function getAuthenticatedUserId(): Promise<string | null> {
    try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getUser();
        return data.user?.id ?? null;
    } catch {
        return null;
    }
}

export async function POST(request: NextRequest) {
    // 1. Auth guard — before parsing the body or calling any provider.
    const userId = await getAuthenticatedUserId();
    if (!userId) {
        return NextResponse.json(
            { error: "You must be signed in to generate." },
            { status: 401 }
        );
    }

    // 2. Parse + validate the discriminated body. All validation runs before
    //    the provider call.
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Request body must be valid JSON." },
            { status: 400 }
        );
    }

    const { mode, input, depth } = (body ?? {}) as {
        mode?: unknown;
        input?: unknown;
        depth?: unknown;
    };

    if (typeof input !== "string" || input.trim() === "") {
        return NextResponse.json({ error: "Input is required." }, { status: 400 });
    }

    if (input.length > MAX_INPUT_LENGTH) {
        return NextResponse.json(
            { error: `Input must be ${MAX_INPUT_LENGTH} characters or fewer.` },
            { status: 400 }
        );
    }

    if (!isKnownMode(mode)) {
        return NextResponse.json(
            { error: "Unsupported generation mode." },
            { status: 400 }
        );
    }

    // 3. Dispatch on the recognized mode. Today only Pattern A (`project`);
    //    Epic 3 slots `goal`/`step` branches in here.
    let systemPrompt: string;
    let userMessage: string;
    let planningDepth: PlanningDepth;
    const trimmedInput = input.trim();

    switch (mode) {
        case "project": {
            // Depth is a first-class, required input for a project request: it
            // selects the prompt and the persisted `planning_depth`. Reject a
            // missing/invalid depth before the provider call.
            if (!isKnownDepth(depth)) {
                return NextResponse.json(
                    { error: "A valid planning depth is required." },
                    { status: 400 }
                );
            }
            planningDepth = depth;
            systemPrompt = PROMPT_BY_DEPTH[depth];
            userMessage = `My project: ${trimmedInput}`;
            break;
        }
        default: {
            // Exhaustive today; guards a future mode added to the union without
            // a dispatch branch.
            const unreachable: never = mode;
            return NextResponse.json(
                { error: `Unsupported generation mode: ${String(unreachable)}` },
                { status: 400 }
            );
        }
    }

    // 4. Delegate the provider call to lib/ai (owns provider selection + 30s
    //    timeout). Map its errors to actionable statuses.
    let markdown: string;
    try {
        markdown = await generate(systemPrompt, userMessage);
    } catch (error) {
        return mapGenerateError(error);
    }

    // 5. Save-before-return: persist the breakdown as ONE project row owned by
    //    the signed-in user, then return the new row id. The client navigates
    //    only after it has the id, so it never holds an unsaved result.
    const parsed = parseProjectBreakdown(markdown, trimmedInput);
    const row: ProjectInsert = {
        user_id: userId,
        goal_id: null, // Project Mode is the permitted null-goal case.
        planning_depth: planningDepth,
        breakdown_md: markdown,
        name: parsed.name,
        purpose: parsed.purpose || null,
        successful_outcome: parsed.successful_outcome || null,
    };

    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("projects")
            .insert(row)
            .select("id")
            .single();

        if (error || !data?.id) {
            console.error(
                "[api/generate] project insert failed:",
                error?.message ?? "no row returned"
            );
            return NextResponse.json(
                { error: "Failed to save the generated project. Please try again." },
                { status: 500 }
            );
        }

        return NextResponse.json({ id: data.id });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "unexpected insert error";
        console.error("[api/generate] project insert threw:", message);
        return NextResponse.json(
            { error: "Failed to save the generated project. Please try again." },
            { status: 500 }
        );
    }
}

/**
 * Map an error thrown by `generate()` to a clear, actionable JSON response.
 *
 * `lib/ai` surfaces timeouts as an Error whose message contains "timed out"
 * (it aborts at 30s), empty-but-OK responses and provider/config failures as
 * plain Errors. We map timeouts to 504 and everything else to 500, preserving
 * the (already user-safe, key-free) message so the client can show guidance
 * such as adding the provider key to `.env.local`.
 */
function mapGenerateError(error: unknown): NextResponse {
    const message =
        error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.";

    const isTimeout =
        (error instanceof Error && /timed out/i.test(error.message)) ||
        (typeof error === "object" &&
            error !== null &&
            "name" in error &&
            (error as { name?: unknown }).name === "AbortError");

    if (isTimeout) {
        return NextResponse.json(
            {
                error:
                    "The request timed out after 30 seconds. Please try again.",
            },
            { status: 504 }
        );
    }

    console.error("[api/generate] generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
}
