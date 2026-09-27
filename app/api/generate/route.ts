/**
 * Single generation endpoint (Pattern A).
 *
 * This is the ONE authenticated route that every generation flow shares:
 *   1. Auth guard — reject any request without a valid Supabase session with
 *      401 *before* any provider call is made.
 *   2. Validation — parse the discriminated body `{ mode, input }` and reject
 *      empty/whitespace, over-cap (>2000 chars), and unknown modes with 400,
 *      all before the provider call.
 *   3. Dispatch — route the recognized mode through `generate()` from
 *      `lib/ai`, which owns provider selection and the 30-second timeout.
 *   4. Response — non-streamed JSON: success `{ markdown }`, failure `{ error }`.
 *
 * Epic 3 adds Patterns B/C (goal framework / goal generate) by adding a branch
 * to the `switch (mode)` below — reusing this same auth check, provider path,
 * and timeout handler. It never introduces a second endpoint, inline provider
 * fetch code, or hardcoded model strings.
 */

import { generate } from "@/lib/ai";
import { PROJECT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** Hard server-side safety cap. Longer input is rejected before the AI call. */
const MAX_INPUT_LENGTH = 2000;

/** Modes wired on this route today. Epic 3 extends this union. */
const KNOWN_MODES = ["project"] as const;
type Mode = (typeof KNOWN_MODES)[number];

function isKnownMode(value: unknown): value is Mode {
    return (
        typeof value === "string" && (KNOWN_MODES as readonly string[]).includes(value)
    );
}

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

    const { mode, input } = (body ?? {}) as { mode?: unknown; input?: unknown };

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

    switch (mode) {
        case "project":
            systemPrompt = PROJECT_SYSTEM_PROMPT;
            userMessage = `My project: ${input.trim()}`;
            break;
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
    try {
        const markdown = await generate(systemPrompt, userMessage);
        return NextResponse.json({ markdown });
    } catch (error) {
        return mapGenerateError(error);
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
