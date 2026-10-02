/**
 * Authenticated project-actions collection endpoint (Story 4.4).
 *
 *   POST  /api/projects/[id]/actions  — add a new action (appended to the end).
 *   PATCH /api/projects/[id]/actions  — reorder the project's actions.
 *
 * Follows the Epic 4 mutation convention: guard auth first, validate the body,
 * scope every query by the acting user + the project id (RLS also enforces it).
 *
 * Reorder is safe-by-contract: the client sends the full ordered list of the
 * project's action ids; the `reorder_project_actions` RPC verifies that set is
 * EXACTLY the project's current action ids before atomically writing
 * `sort_order = index`. A missing or foreign id is a 400 with no write, so a
 * reorder can never drop or adopt an action — and a mid-loop failure can never
 * leave a partial order.
 */

import { sanitizeActionText } from "@/lib/actions/validate";
import { sanitizeContextTags } from "@/lib/actions/tags";
import type { ActionInsert } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Confirm the signed-in user owns the project; returns true/false. */
async function userOwnsProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  const { id: projectId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const obj = (body ?? {}) as Record<string, unknown>;
  const text = sanitizeActionText(obj.text);
  if (text === null) {
    return NextResponse.json(
      { error: "Action text is required." },
      { status: 400 },
    );
  }
  const tags = sanitizeContextTags(obj.context_tags);
  if (tags === null) {
    return NextResponse.json(
      { error: "Invalid context tags." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    if (!(await userOwnsProject(supabase, projectId, userId))) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Append: next sort_order = current max + 1 (0 when empty).
    const { data: existing } = await supabase
      .from("actions")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextSort =
      existing && existing.length > 0
        ? (existing[0].sort_order as number) + 1
        : 0;

    const row: ActionInsert = {
      user_id: userId,
      project_id: projectId,
      text,
      context_tags: tags,
      sort_order: nextSort,
    };

    const { data, error } = await supabase
      .from("actions")
      .insert(row)
      .select("id")
      .single();

    if (error || !data) {
      console.error(
        "[api/projects/actions POST] insert failed:",
        error?.message ?? "no row",
      );
      return NextResponse.json(
        { error: "Failed to add the action. Please try again." },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/projects/actions POST] threw:", message);
    return NextResponse.json(
      { error: "Failed to add the action. Please try again." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  const { id: projectId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const orderedIds = (body as { orderedIds?: unknown })?.orderedIds;
  if (
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0 ||
    !orderedIds.every((v) => typeof v === "string")
  ) {
    return NextResponse.json(
      { error: "A non-empty ordered list of action ids is required." },
      { status: 400 },
    );
  }
  const ids = orderedIds as string[];
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: "Duplicate action ids in the reorder request." },
      { status: 400 },
    );
  }
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!ids.every((v) => uuidRe.test(v))) {
    return NextResponse.json(
      { error: "The reorder list contains an invalid action id." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    if (!(await userOwnsProject(supabase, projectId, userId))) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Verify the submitted set is EXACTLY the project's action ids and write
    // sort_order = index for each, all in one atomic RPC. A mismatched set
    // raises SQLSTATE 22000 (mapped to 400); any other failure is a 500. No
    // partial reorder can ever be persisted.
    const { error: reorderError } = await supabase.rpc(
      "reorder_project_actions",
      {
        p_project_id: projectId,
        p_action_ids: ids,
      },
    );

    if (reorderError) {
      if ((reorderError as { code?: string }).code === "22000") {
        return NextResponse.json(
          { error: "The reorder list must match this project's actions exactly." },
          { status: 400 },
        );
      }
      if ((reorderError as { code?: string }).code === "P0002") {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      console.error(
        "[api/projects/actions PATCH] reorder RPC failed:",
        reorderError.message,
      );
      return NextResponse.json(
        { error: "Failed to reorder actions. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/projects/actions PATCH] threw:", message);
    return NextResponse.json(
      { error: "Failed to reorder actions. Please try again." },
      { status: 500 },
    );
  }
}
