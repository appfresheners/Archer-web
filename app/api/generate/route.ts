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
 *   4. Save-before-return — generation returns STRUCTURED JSON (never
 *      markdown). On success, write ONE `projects` row owned by the signed-in
 *      user (with the chosen `planning_depth`, `goal_id = null`, the scalar
 *      `name`/`purpose`/`successful_outcome`, and the Full-GTD extras in
 *      `planning_detail`) plus one `actions` row per next action, then return
 *      `{ id }`. An insert failure maps to 500 (with rollback) and the client
 *      never navigates. No markdown is stored anywhere.
 *
 * Epic 3 adds Patterns B/C (goal framework / goal generate) by adding a branch
 * to the `switch (mode)` below — reusing this same auth check, provider path,
 * and timeout handler. It never introduces a second endpoint, inline provider
 * fetch code, or hardcoded model strings.
 */

import { generateFramework } from "@/lib/goals/generate-framework";
import { generateProject } from "@/lib/projects/generate-project";
import type {
    ActionInsert,
    PlanningDepth,
    ProjectInsert,
} from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** Hard server-side safety cap. Longer input is rejected before the AI call. */
const MAX_INPUT_LENGTH = 2000;

/** Modes wired on this route today. Epic 3 extends this union. */
const KNOWN_MODES = ["project", "goal"] as const;
type Mode = (typeof KNOWN_MODES)[number];

/** Valid `planning_depth` values accepted for a project request. */
const KNOWN_DEPTHS = ["minimal", "full_gtd"] as const;

/** Valid `step` values accepted for a `goal` request. */
const KNOWN_GOAL_STEPS = ["framework", "generate"] as const;
type GoalStep = (typeof KNOWN_GOAL_STEPS)[number];

function isKnownMode(value: unknown): value is Mode {
    return (
        typeof value === "string" && (KNOWN_MODES as readonly string[]).includes(value)
    );
}

function isKnownGoalStep(value: unknown): value is GoalStep {
    return (
        typeof value === "string" &&
        (KNOWN_GOAL_STEPS as readonly string[]).includes(value)
    );
}

function isKnownDepth(value: unknown): value is PlanningDepth {
    return (
        typeof value === "string" &&
        (KNOWN_DEPTHS as readonly string[]).includes(value)
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

    const { mode, input, depth, step, goal } = (body ?? {}) as {
        mode?: unknown;
        input?: unknown;
        depth?: unknown;
        step?: unknown;
        goal?: unknown;
    };

    if (!isKnownMode(mode)) {
        return NextResponse.json(
            { error: "Unsupported generation mode." },
            { status: 400 }
        );
    }

    // 3. Dispatch on the recognized mode. Pattern A (`project`) and Pattern B
    //    (`goal`/`framework`) share this one auth check, provider path, and
    //    30-second timeout.
    if (mode === "goal") {
        return handleGoal(step, goal);
    }

    if (mode !== "project") {
        // Exhaustive today; guards a future mode added to the union without a
        // dispatch branch.
        const unreachable: never = mode;
        return NextResponse.json(
            { error: `Unsupported generation mode: ${String(unreachable)}` },
            { status: 400 }
        );
    }

    // --- Pattern A (`project`) — validation + dispatch, unchanged. ---

    if (typeof input !== "string" || input.trim() === "") {
        return NextResponse.json({ error: "Input is required." }, { status: 400 });
    }

    if (input.length > MAX_INPUT_LENGTH) {
        return NextResponse.json(
            { error: `Input must be ${MAX_INPUT_LENGTH} characters or fewer.` },
            { status: 400 }
        );
    }

    const trimmedInput = input.trim();

    // Depth is a first-class, required input for a project request: it selects
    // the prompt and the persisted `planning_depth`. Reject a missing/invalid
    // depth before the provider call.
    if (!isKnownDepth(depth)) {
        return NextResponse.json(
            { error: "A valid planning depth is required." },
            { status: 400 }
        );
    }
    const planningDepth: PlanningDepth = depth;

    // 4. Generate a STRUCTURED project (JSON) via lib/projects (which owns the
    //    prompt selection, the provider call, the 30s timeout, and JSON
    //    validation). No markdown is produced or stored.
    let generated;
    try {
        generated = await generateProject(trimmedInput, planningDepth);
    } catch (error) {
        return mapGenerateError(error);
    }

    // 5. Save-before-return: persist the breakdown as structured rows owned by
    //    the signed-in user — ONE `projects` row plus one `actions` row per
    //    next action — then return the new project id. The client navigates
    //    only after it has the id, so it never holds an unsaved result.
    const projectRow: ProjectInsert = {
        user_id: userId,
        goal_id: null, // Project Mode is the permitted null-goal case.
        planning_depth: planningDepth,
        name: generated.name,
        purpose: generated.purpose,
        successful_outcome: generated.successful_outcome,
        planning_detail: generated.detail, // null for minimal depth
    };

    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("projects")
            .insert(projectRow)
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

        const projectId = data.id as string;

        // Persist the 12 next actions as structured, ordered `actions` rows.
        const actionRows: ActionInsert[] = generated.next_actions.map(
            (text, index) => ({
                user_id: userId,
                project_id: projectId,
                text,
                sort_order: index,
            })
        );

        const { error: actionsError } = await supabase
            .from("actions")
            .insert(actionRows);

        if (actionsError) {
            // The project saved but its actions did not. Roll back the orphaned
            // project so the user can cleanly retry rather than landing on a
            // half-saved breakdown.
            console.error(
                "[api/generate] actions insert failed, rolling back project:",
                actionsError.message
            );
            await supabase.from("projects").delete().eq("id", projectId);
            return NextResponse.json(
                { error: "Failed to save the generated project. Please try again." },
                { status: 500 }
            );
        }

        return NextResponse.json({ id: projectId });
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
 * Pattern B (Story 3.2) — goal skill-framework generation.
 *
 * Runs AFTER the shared auth guard in `POST`. Validates `step` and `goal`
 * (same non-empty + ≤2000-char rules Pattern A enforces on `input`), then
 * calls `generateFramework(goal)` and returns the framework JSON. Writes NO
 * Supabase row — the wizard holds the framework in transient state.
 *
 * The response contains only the AI-owned Target Profile (`name`,
 * `required_level`, `description`); no user current-rating field is present.
 */
async function handleGoal(step: unknown, goal: unknown): Promise<NextResponse> {
    if (!isKnownGoalStep(step)) {
        return NextResponse.json(
            { error: "A valid goal step is required." },
            { status: 400 }
        );
    }

    // `generate` is Pattern C (Story 3.6) and is not wired yet.
    if (step !== "framework") {
        return NextResponse.json(
            { error: "This goal step is not yet supported." },
            { status: 400 }
        );
    }

    if (typeof goal !== "string" || goal.trim() === "") {
        return NextResponse.json({ error: "Goal is required." }, { status: 400 });
    }

    if (goal.length > MAX_INPUT_LENGTH) {
        return NextResponse.json(
            { error: `Goal must be ${MAX_INPUT_LENGTH} characters or fewer.` },
            { status: 400 }
        );
    }

    try {
        const { framework } = await generateFramework(goal.trim());
        return NextResponse.json({ framework });
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
