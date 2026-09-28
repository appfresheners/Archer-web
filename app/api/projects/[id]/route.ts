/**
 * Authenticated project-edit endpoint (Story 4.3).
 *
 *   PATCH /api/projects/[id] — edit the project's name/purpose/successful
 *   outcome and/or change its status (active/paused/completed/archived).
 *
 * Follows the Epic 4 mutation convention established by `/api/goals/[id]`:
 * guard auth before any DB work, validate the body server-side, and scope the
 * update by `id` + `user_id` (RLS also enforces ownership). Completing all of
 * a project's actions never auto-completes the project — completion is only
 * ever an explicit status change through this route.
 */

import { sanitizeProjectPatch } from "@/lib/projects/validate";
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const patch = sanitizeProjectPatch(body);
  if (!patch) {
    return NextResponse.json(
      { error: "No valid project fields to update." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[api/projects PATCH] update failed:", error.message);
      return NextResponse.json(
        { error: "Failed to update the project. Please try again." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/projects PATCH] threw:", message);
    return NextResponse.json(
      { error: "Failed to update the project. Please try again." },
      { status: 500 },
    );
  }
}
