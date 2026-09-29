/**
 * Authenticated per-inbox-item endpoint (Story 5.1).
 *
 *   DELETE /api/inbox/[id]  — remove a captured inbox item.
 *
 * Scoped by the acting user (RLS also enforces ownership); a non-owned or
 * unknown id yields 404. A hard delete is acceptable at the capture stage
 * because no processing links exist yet (Story 5.2 introduces those). Mirrors
 * `app/api/actions/[id]/route.ts`.
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
