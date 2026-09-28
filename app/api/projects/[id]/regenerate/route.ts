/**
 * Authenticated single-project regeneration endpoint (Story 4.3).
 *
 *   POST /api/projects/[id]/regenerate
 *
 * Regenerates ONLY the given project: it reuses the shared structured
 * `generateProject` (which owns prompt selection, the provider call, the 30s
 * timeout, and JSON validation), then replaces this project's AI content
 * (`name`/`purpose`/`successful_outcome`/`planning_detail`) and its actions —
 * leaving every sibling project untouched.
 *
 * Action replacement is delete-then-insert. To avoid leaving the project with
 * no actions on a partial failure, the existing action rows are read first; if
 * inserting the freshly generated actions fails after the delete, the original
 * rows are restored and a 500 is returned.
 *
 * Errors mirror `/api/generate`: a provider timeout maps to 504, everything
 * else to 500 (preserving the already user-safe message).
 */

import { generateProject } from "@/lib/projects/generate-project";
import type { ActionInsert, PlanningDepth } from "@/lib/supabase/schema";
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
      { error: "The request timed out after 30 seconds. Please try again." },
      { status: 504 },
    );
  }
  console.error("[api/projects regenerate] generation error:", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const supabase = await createClient();

  // Load the owned project (name/purpose drive the regeneration input; depth
  // selects the prompt). RLS + explicit user_id guard scope this to the owner.
  const { data: project, error: readError } = await supabase
    .from("projects")
    .select("id, name, purpose, planning_depth")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    console.error("[api/projects regenerate] read failed:", readError.message);
    return NextResponse.json(
      { error: "Failed to regenerate the project. Please try again." },
      { status: 500 },
    );
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const depth = project.planning_depth as PlanningDepth;
  const input = project.purpose
    ? `${project.name} — ${project.purpose}`
    : project.name;

  // Generate the new structured breakdown (may throw timeout/provider/format).
  let generated;
  try {
    generated = await generateProject(input, depth);
  } catch (error) {
    return mapGenerateError(error);
  }

  try {
    // 1. Update the project's AI content in place (never touches siblings).
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        name: generated.name,
        purpose: generated.purpose,
        successful_outcome: generated.successful_outcome,
        planning_detail: generated.detail,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (updateError) {
      console.error(
        "[api/projects regenerate] project update failed:",
        updateError.message,
      );
      return NextResponse.json(
        { error: "Failed to save the regenerated project. Please try again." },
        { status: 500 },
      );
    }

    // 2. Snapshot the existing actions so we can restore them on a failure.
    const { data: existingActions } = await supabase
      .from("actions")
      .select("text, status, context_tags, sort_order")
      .eq("project_id", id)
      .order("sort_order", { ascending: true });

    // 3. Replace actions: delete the project's current actions, insert the new 12.
    const { error: deleteError } = await supabase
      .from("actions")
      .delete()
      .eq("project_id", id)
      .eq("user_id", userId);

    if (deleteError) {
      console.error(
        "[api/projects regenerate] actions delete failed:",
        deleteError.message,
      );
      return NextResponse.json(
        { error: "Failed to save the regenerated project. Please try again." },
        { status: 500 },
      );
    }

    const newActionRows: ActionInsert[] = generated.next_actions.map(
      (text, index) => ({
        user_id: userId,
        project_id: id,
        text,
        sort_order: index,
      }),
    );

    const { error: insertError } = await supabase
      .from("actions")
      .insert(newActionRows);

    if (insertError) {
      console.error(
        "[api/projects regenerate] actions insert failed, restoring originals:",
        insertError.message,
      );
      // Best-effort restore of the prior actions so the project is not left
      // action-less after a failed regeneration.
      if (existingActions && existingActions.length > 0) {
        const restore: ActionInsert[] = existingActions.map((a) => ({
          user_id: userId,
          project_id: id,
          text: a.text as string,
          status: a.status as ActionInsert["status"],
          context_tags: a.context_tags as string[] | null,
          sort_order: a.sort_order as number,
        }));
        await supabase.from("actions").insert(restore);
      }
      return NextResponse.json(
        { error: "Failed to save the regenerated project. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/projects regenerate] threw:", message);
    return NextResponse.json(
      { error: "Failed to save the regenerated project. Please try again." },
      { status: 500 },
    );
  }
}
