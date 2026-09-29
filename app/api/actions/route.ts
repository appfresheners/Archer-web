/**
 * Authenticated action-collection endpoint (Story 5.2 — Clarify Wizard).
 *
 *   POST /api/actions  — create a STANDALONE-or-assigned action.
 *
 * Used by the clarify flow to spawn the outcome of a "defer" decision: a plain
 * next action (standalone), a delegated `waiting` action, a `scheduled_for`
 * (calendar) action, or an action assigned to an existing project. New actions
 * default to standalone (`project_id = null`); when a `project_id` is supplied
 * it is trusted to RLS (a non-owned project id simply cannot be inserted
 * under this user because the row is scoped by `user_id` + RLS policies).
 *
 * Mirrors the Epic 4/5 mutation convention: auth → 401; JSON parse → 400;
 * sanitize → 400; insert scoped to the acting user; `.select("id").single()`;
 * 500 + `console.error("[api/actions ...]")` on failure.
 */

import { sanitizeActionCreate } from "@/lib/actions/create";
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

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const clean = sanitizeActionCreate(body);
  if (!clean) {
    return NextResponse.json(
      { error: "No valid action to create." },
      { status: 400 },
    );
  }

  const row: ActionInsert = {
    user_id: userId,
    project_id: clean.project_id, // standalone (null) by default
    text: clean.text,
    status: clean.status, // "waiting" for delegate
    delegated_to: clean.delegated_to,
    scheduled_for: clean.scheduled_for,
  };

  try {
    const supabase = await createClient();

    // Cross-owner guard: RLS's WITH CHECK on `actions` only constrains the
    // action's own user_id, and the project_id FK only checks existence — not
    // ownership. So verify any supplied project_id belongs to the acting user
    // before linking, otherwise an action could be attached to another user's
    // project. A standalone action (null project_id) skips this check.
    if (row.project_id) {
      const { data: owned, error: ownErr } = await supabase
        .from("projects")
        .select("id")
        .eq("id", row.project_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (ownErr) {
        console.error("[api/actions POST] project ownership check failed:", ownErr.message);
        return NextResponse.json(
          { error: "Failed to create the action. Please try again." },
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

    const { data, error } = await supabase
      .from("actions")
      .insert(row)
      .select("id")
      .single();

    if (error || !data) {
      console.error(
        "[api/actions POST] insert failed:",
        error?.message ?? "no row returned",
      );
      return NextResponse.json(
        { error: "Failed to create the action. Please try again." },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/actions POST] threw:", message);
    return NextResponse.json(
      { error: "Failed to create the action. Please try again." },
      { status: 500 },
    );
  }
}
