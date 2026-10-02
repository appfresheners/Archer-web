/**
 * Authenticated commit endpoint (Story 4.5).
 *
 *   POST /api/actions/[id]/commit  — make this action the project's single
 *   committed next action.
 *
 * This is a dedicated route (the generic `PATCH /api/actions/[id]` deliberately
 * rejects `committed`) that simply sets the owned action's status to
 * `committed`. The single-committed-per-project invariant is enforced by the
 * `fn_commit_action` BEFORE UPDATE trigger, which decommits any other committed
 * action on the same project — so the rule holds at the database layer, not
 * only in the UI.
 */

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

export async function POST(_request: NextRequest, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const supabase = await createClient();
    // Setting status to 'committed' fires fn_commit_action, which decommits any
    // sibling committed action on the same project (scoped by user_id + RLS).
    // The partial unique index `actions(project_id) WHERE status='committed'`
    // is the DB backstop: a concurrent commit that loses the race surfaces as a
    // unique violation (23505), mapped to a friendly 409 below.
    const { data, error } = await supabase
      .from("actions")
      .update({ status: "committed" })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json(
          { error: "Another action is already committed for this project." },
          { status: 409 },
        );
      }
      console.error("[api/actions commit] update failed:", error.message);
      return NextResponse.json(
        { error: "Failed to commit the action. Please try again." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Action not found." }, { status: 404 });
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/actions commit] threw:", message);
    return NextResponse.json(
      { error: "Failed to commit the action. Please try again." },
      { status: 500 },
    );
  }
}
