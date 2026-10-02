/**
 * Authenticated single-project regeneration endpoint (Story 4.3).
 *
 *   POST /api/projects/[id]/regenerate
 *
 * Regenerates ONLY the given project: it reuses the shared structured
 * `generateProject` (which owns prompt selection, the provider call, the 30s
 * timeout, and JSON validation), then replaces this project's AI content
 * (`name`/`purpose`/`successful_outcome`/`planning_detail`) and its actions in
 * one atomic `regenerate_project_actions` RPC — leaving every sibling project
 * untouched, and never leaving the project action-less on a partial failure.
 *
 * Errors mirror `/api/generate`: a provider timeout maps to 504, everything
 * else to 500 (preserving the already user-safe message).
 */

import { generateProject } from "@/lib/projects/generate-project";
import type { PlanningDepth } from "@/lib/supabase/schema";
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
    // Replace the project's AI content and its actions in one atomic RPC.
    // A failure partway through rolls the whole transaction back, so the
    // project is never left without actions.
    const { error: regenerateError } = await supabase.rpc(
      "regenerate_project_actions",
      {
        p_project_id: id,
        p_project: {
          name: generated.name,
          purpose: generated.purpose,
          successful_outcome: generated.successful_outcome,
          planning_detail: generated.detail,
        },
        p_actions: generated.next_actions.map((text, index) => ({
          text,
          sort_order: index,
        })),
      },
    );

    if (regenerateError) {
      if ((regenerateError as { code?: string }).code === "P0002") {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      console.error(
        "[api/projects regenerate] RPC failed:",
        regenerateError.message,
      );
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
