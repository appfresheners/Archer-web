/**
 * Authenticated project collection endpoint (Story 2.7).
 *
 *   POST /api/projects — create a single project manually (no AI call).
 *
 * The manual path mirrors the AI save in `/api/generate` minus the provider
 * call and next-action creation: guard auth first, validate the body with
 * `validateManualProject`, verify a supplied goal belongs to the signed-in
 * user, then insert ONE `projects` row owned by that user (relying on the
 * column defaults `status='active'`, `planning_depth='minimal'`,
 * `sort_order=0`) and return `{ id }`. No actions are created here — the newly
 * created Active project renders as stuck until the user commits an action.
 */

import { validateManualProject } from "@/lib/projects/create";
import type { ProjectInsert } from "@/lib/supabase/schema";
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

export async function POST(request: NextRequest) {
  // 1. Auth guard — before any DB work.
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "You must be signed in to create a project." },
      { status: 401 },
    );
  }

  // 2. Parse + validate the body. No AI provider is involved.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const input = validateManualProject(body);
  if (!input) {
    return NextResponse.json(
      { error: "A valid project name is required." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();

    // 3. Cross-owner guard: a supplied goal_id must resolve to a goal owned by
    //    the acting user. RLS on `projects` only checks the project's user_id
    //    and the FK only checks the goal exists — neither prevents linking to
    //    another user's goal. Mirrors the inbox route's resolved_project_id
    //    ownership check.
    if (input.goal_id) {
      const { data: owned, error: ownErr } = await supabase
        .from("goals")
        .select("id")
        .eq("id", input.goal_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (ownErr) {
        console.error(
          "[api/projects POST] goal ownership check failed:",
          ownErr.message,
        );
        return NextResponse.json(
          { error: "Failed to create the project. Please try again." },
          { status: 500 },
        );
      }
      if (!owned) {
        return NextResponse.json(
          { error: "That goal was not found." },
          { status: 400 },
        );
      }
    }

    // 4. Insert ONE project row owned by the signed-in user. Defaults supply
    //    `status`, `planning_depth`, and `sort_order`; no migration needed.
    const projectRow: ProjectInsert = {
      user_id: userId,
      goal_id: input.goal_id,
      name: input.name,
      purpose: input.purpose,
      successful_outcome: input.successful_outcome,
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(projectRow)
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error(
        "[api/projects POST] project insert failed:",
        error?.message ?? "no row returned",
      );
      return NextResponse.json(
        { error: "Failed to create the project. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unexpected insert error";
    console.error("[api/projects POST] project insert threw:", message);
    return NextResponse.json(
      { error: "Failed to create the project. Please try again." },
      { status: 500 },
    );
  }
}
