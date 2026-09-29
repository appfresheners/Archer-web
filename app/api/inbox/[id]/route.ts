/**
 * Authenticated per-inbox-item endpoint (Story 5.1).
 *
 *   PATCH  /api/inbox/[id]  — record a clarify outcome: set the terminal
 *                            processing_status (+ processed_at, optional
 *                            resolved_project_id). Story 5.2.
 *   DELETE /api/inbox/[id]  — remove a captured inbox item.
 *
 * Scoped by the acting user (RLS also enforces ownership); a non-owned or
 * unknown id yields 404. Mirrors `app/api/actions/[id]/route.ts`.
 */

import { sanitizeInboxProcess } from "@/lib/inbox/process";
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
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
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

  const patch = sanitizeInboxProcess(body);
  if (!patch) {
    return NextResponse.json(
      { error: "No valid processing outcome to record." },
      { status: 400 },
    );
  }

  // The validator is pure; stamp the processing time on the server.
  patch.processed_at = new Date().toISOString();

  try {
    const supabase = await createClient();

    // Cross-owner guard: a supplied resolved_project_id must belong to the
    // acting user. RLS on inbox_items only checks the row's user_id and the FK
    // only checks the project exists — neither prevents linking to another
    // user's project. A null/absent resolved_project_id skips this.
    if (patch.resolved_project_id) {
      const { data: owned, error: ownErr } = await supabase
        .from("projects")
        .select("id")
        .eq("id", patch.resolved_project_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (ownErr) {
        console.error("[api/inbox PATCH] project ownership check failed:", ownErr.message);
        return NextResponse.json(
          { error: "Failed to process the item. Please try again." },
          { status: 500 },
        );
      }
      if (!owned) {
        return NextResponse.json(
          { error: "That project was not found." },
          { status: 400 },
        );
      }
    }

    // Only an UNPROCESSED item may be moved to a terminal state — this both
    // prevents re-processing (overwriting a prior outcome / creating duplicate
    // actions from a stale tab) and makes the PATCH idempotent-safe. A terminal
    // or unknown/non-owned id yields the 404 below.
    const { data, error } = await supabase
      .from("inbox_items")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .eq("processing_status", "unprocessed")
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[api/inbox PATCH] update failed:", error.message);
      return NextResponse.json(
        { error: "Failed to process the item. Please try again." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/inbox PATCH] threw:", message);
    return NextResponse.json(
      { error: "Failed to process the item. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  const { id } = await context.params;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("inbox_items")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[api/inbox DELETE] delete failed:", error.message);
      return NextResponse.json(
        { error: "Failed to delete the item. Please try again." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/inbox DELETE] threw:", message);
    return NextResponse.json(
      { error: "Failed to delete the item. Please try again." },
      { status: 500 },
    );
  }
}
