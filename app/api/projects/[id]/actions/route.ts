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
 * project's action ids; the server verifies that set is EXACTLY the project's
 * current action ids before writing `sort_order = index`. A missing or foreign
 * id is a 400 with no write, so a reorder can never drop or adopt an action.
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

  try {
    const supabase = await createClient();
    if (!(await userOwnsProject(supabase, projectId, userId))) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Load the project's current action ids and verify the submitted set is
    // EXACTLY equal — no missing, no foreign ids — before any write.
    const { data: current, error: readError } = await supabase
      .from("actions")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (readError) {
      console.error("[api/projects/actions PATCH] read failed:", readError.message);
      return NextResponse.json(
        { error: "Failed to reorder actions. Please try again." },
        { status: 500 },
      );
    }

    const currentIds = new Set((current ?? []).map((a) => a.id as string));
    if (
      currentIds.size !== ids.length ||
      !ids.every((id) => currentIds.has(id))
    ) {
      return NextResponse.json(
        { error: "The reorder list must match this project's actions exactly." },
        { status: 400 },
      );
    }

    // Persist sort_order = index for each action, scoped to the owner.
    for (let index = 0; index < ids.length; index++) {
      const { error: updateError } = await supabase
        .from("actions")
        .update({ sort_order: index })
        .eq("id", ids[index])
        .eq("user_id", userId);
      if (updateError) {
        console.error(
          "[api/projects/actions PATCH] update failed:",
          updateError.message,
        );
        return NextResponse.json(
          { error: "Failed to reorder actions. Please try again." },
          { status: 500 },
        );
      }
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
