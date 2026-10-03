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
import { generateGoal } from "@/lib/goals/generate-goal";
import { generateProject } from "@/lib/projects/generate-project";
import { GenerationFormatError } from "@/lib/ai";
import type {
    ActionInsert,
    PlanningDepth,
    ProjectInsert,
    SkillFrameworkItem
} from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** Minimum confirmed framework items required for a Pattern C generation. */
const MIN_FRAMEWORK_ITEMS = 3;

/**
 * Upper bound on confirmed framework items accepted for a save. Pattern B
 * proposes 5–8 and the user may add a few; this is a generous safety ceiling
 * that rejects a malformed/oversized payload before it reaches the prompt/DB.
 */
const MAX_FRAMEWORK_ITEMS_SAVE = 30;

/** Max entries accepted for each of drivers / barriers (safety cap). */
const MAX_LIST_ITEMS = 30;

/** Inclusive range a framework item's required level / user rating must fall in. */
const MIN_LEVEL = 1;
const MAX_LEVEL = 10;

/** Months added to today to compute a new goal's target date. */
const TARGET_DATE_MONTHS = 3;

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

    const { mode, input, depth, step, goal, why, framework, drivers, barriers, ifThens } =
        (body ?? {}) as {
            mode?: unknown;
            input?: unknown;
            depth?: unknown;
            step?: unknown;
            goal?: unknown;
            why?: unknown;
            framework?: unknown;
            drivers?: unknown;
            barriers?: unknown;
            ifThens?: unknown;
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
        return handleGoal(userId, {
            step,
            goal,
            why,
            framework,
            drivers,
            barriers,
            ifThens,
        }, request.signal);
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
        generated = await generateProject(trimmedInput, planningDepth, {
            signal: request.signal,
        });
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
interface GoalRequestFields {
    step: unknown;
    goal: unknown;
    why: unknown;
    framework: unknown;
    drivers: unknown;
    barriers: unknown;
    ifThens: unknown;
}

async function handleGoal(
    userId: string,
    fields: GoalRequestFields,
    signal: AbortSignal
): Promise<NextResponse> {
    const { step, goal, why } = fields;

    if (!isKnownGoalStep(step)) {
        return NextResponse.json(
            { error: "A valid goal step is required." },
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

    if (typeof why !== "string" || why.trim() === "") {
        return NextResponse.json(
            { error: "Why is required for every goal." },
            { status: 400 }
        );
    }

    if (why.length > MAX_INPUT_LENGTH) {
        return NextResponse.json(
            { error: `Why must be ${MAX_INPUT_LENGTH} characters or fewer.` },
            { status: 400 }
        );
    }

    if (step === "framework") {
        try {
            const { framework } = await generateFramework(goal.trim(), why.trim(), {
                signal,
            });
            return NextResponse.json({ framework });
        } catch (error) {
            return mapGenerateError(error);
        }
    }

    // Pattern C (`generate`) — validate the full payload, generate the
    // breakdown, then persist goals→projects→actions with rollback.
    return handleGoalGenerate(userId, goal.trim(), why.trim(), fields, signal);
}

/**
 * Pattern C (Story 3.6) — full goal breakdown generation + save.
 *
 * Validates the confirmed framework (≥3 items, each with an integer
 * required_level and user_rating in 1–10) and the user's own drivers/barriers/
 * if–then (non-empty), all BEFORE the provider call. On a successful
 * generation, writes ONE `goals` row, one `projects` row per generated project,
 * and one `actions` row per next action — all owned by the signed-in user — and
 * returns `{ id }` (the new goal id). Any insert failure rolls back the written
 * rows (delete the goal + its projects/actions) and returns 500 so the client
 * never navigates to an unsaved result.
 */
async function handleGoalGenerate(
    userId: string,
    goal: string,
    why: string,
    fields: GoalRequestFields,
    signal: AbortSignal
): Promise<NextResponse> {
    const { framework, drivers, barriers, ifThens } = fields;

    const validFramework = validateFramework(framework);
    if (!validFramework) {
        return NextResponse.json(
            {
                error:
                    "A confirmed skill framework with at least 3 rated items is required.",
            },
            { status: 400 }
        );
    }

    if (!isBoundedStringList(drivers)) {
        return NextResponse.json(
            { error: "At least one driver is required." },
            { status: 400 }
        );
    }

    if (!isBoundedStringList(barriers)) {
        return NextResponse.json(
            { error: "At least one barrier is required." },
            { status: 400 }
        );
    }

    if (!isBoundedStringList(ifThens)) {
        return NextResponse.json(
            { error: "At least one valid if–then plan is required." },
            { status: 400 }
        );
    }

    // Generate the STRUCTURED breakdown (JSON) via lib/goals (which owns the
    // prompt, the provider call, the 30s timeout, and JSON validation).
    let generated;
    try {
        generated = await generateGoal({
            goal,
            why,
            framework: validFramework,
            drivers: drivers.map((d) => d.trim()),
            barriers: barriers.map((b) => b.trim()),
            ifThens: ifThens.map((plan) => plan.trim()),
        }, { signal });
    } catch (error) {
        return mapGenerateError(error);
    }

    // Save-before-return: goals → projects → actions, all owned by the user,
    // persisted in one atomic RPC.
    return saveGoalBreakdown(
        goal,
        why,
        validFramework,
        drivers,
        barriers,
        ifThens,
        generated,
    );
}

/**
 * Persist the generated breakdown as linked `goals` + `projects` + `actions`
 * rows via a single atomic RPC. Returns `{ id }` (the new goal id) on success
 * or a 500 when the RPC fails — the RPC's transaction rolls back everything it
 * wrote, so a mid-sequence failure leaves no rows behind.
 */
async function saveGoalBreakdown(
    goal: string,
    why: string,
    framework: SkillFrameworkItem[],
    drivers: string[],
    barriers: string[],
    ifThens: string[],
    generated: Awaited<ReturnType<typeof generateGoal>>
): Promise<NextResponse> {
    const targetDate = computeTargetDate();

    const failure = () =>
        NextResponse.json(
            { error: "Failed to save your goal. Please try again." },
            { status: 500 }
        );

    // The RPC derives the owner from auth.uid(); actions are grouped under
    // their project so the project→action mapping can never desync.
    const projects = generated.projects.map((project, index) => ({
        name: project.name,
        purpose: project.purpose,
        successful_outcome: project.successful_outcome,
        sort_order: index,
        next_actions: project.next_actions,
    }));

    try {
        const supabase = await createClient();

        const { data, error } = await supabase.rpc("save_goal_breakdown", {
            p_goal: {
                goal_text: goal,
                why,
                target_date: targetDate,
                skill_framework: framework,
                drivers: drivers.map((d) => d.trim()),
                barriers: barriers.map((b) => b.trim()),
                if_then_plans: ifThens.map((plan) => plan.trim()),
                goal_statement: generated.goal_statement,
                success_criteria: generated.success_criteria,
            },
            p_projects: projects,
        });

        if (error || !data) {
            console.error(
                "[api/generate] goal save RPC failed:",
                error?.message ?? "no goal id returned",
            );
            return failure();
        }

        return NextResponse.json({ id: data });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "unexpected insert error";
        console.error("[api/generate] goal save threw:", message);
        return failure();
    }
}

/**
 * Validate the confirmed framework payload into a typed `SkillFrameworkItem[]`.
 * Returns `null` when the shape is invalid (empty/<3 items, or any item missing
 * an integer `required_level`/`user_rating` in 1–10 or a non-empty name).
 */
function validateFramework(value: unknown): SkillFrameworkItem[] | null {
    if (
        !Array.isArray(value) ||
        value.length < MIN_FRAMEWORK_ITEMS ||
        value.length > MAX_FRAMEWORK_ITEMS_SAVE
    ) {
        return null;
    }

    const items: SkillFrameworkItem[] = [];
    for (const raw of value) {
        if (typeof raw !== "object" || raw === null) return null;
        const obj = raw as Record<string, unknown>;
        if (typeof obj.name !== "string" || obj.name.trim() === "") return null;
        if (!isLevel(obj.required_level)) return null;
        if (!isLevel(obj.user_rating)) return null;
        items.push({
            name: obj.name.trim(),
            required_level: obj.required_level,
            description:
                typeof obj.description === "string" ? obj.description : "",
            user_rating: obj.user_rating,
        });
    }
    return items;
}

function isLevel(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= MIN_LEVEL &&
        value <= MAX_LEVEL
    );
}

/**
 * A non-empty list of non-empty strings, bounded in count and per-item length,
 * so an oversized drivers/barriers payload can't reach the prompt/DB unchecked.
 */
function isBoundedStringList(value: unknown): value is string[] {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.length <= MAX_LIST_ITEMS &&
        value.every(
            (v) =>
                typeof v === "string" &&
                v.trim() !== "" &&
                v.length <= MAX_INPUT_LENGTH
        )
    );
}

/**
 * Compute the target date (today + 3 months) as an ISO `YYYY-MM-DD` string.
 *
 * Built from LOCAL calendar components (not `toISOString`, which shifts to UTC
 * and can land a day early for negative-UTC-offset users). Month overflow is
 * clamped to the last valid day of the target month, so e.g. Nov 30 + 3mo →
 * Feb 28/29 (not an accidental March 1/2 rollover from `setMonth`).
 */
function computeTargetDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    const targetMonthIndex = month + TARGET_DATE_MONTHS;
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const targetMonth = targetMonthIndex % 12;

    // Day 0 of the *next* month is the last day of the target month → clamp.
    const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const targetDay = Math.min(day, lastDayOfTargetMonth);

    const mm = String(targetMonth + 1).padStart(2, "0");
    const dd = String(targetDay).padStart(2, "0");
    return `${targetYear}-${mm}-${dd}`;
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

    if (error instanceof GenerationFormatError) {
        console.error("[api/generate] generation format error:", error.message);
        return NextResponse.json(
            {
                error:
                    "The AI returned a response in an unexpected format. Please try again.",
            },
            { status: 500 }
        );
    }

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
