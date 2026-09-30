/**
 * Authenticated per-action endpoint (Story 4.4).
 *
 *   PATCH  /api/actions/[id]  — edit the action text and/or its context tags.
 *   DELETE /api/actions/[id]  — remove the action.
 *
 * Scoped by the acting user (RLS also enforces ownership); a non-owned or
 * unknown id yields 404. Status is not editable here — completing/committing
 * has its own paths (Story 4.5).
 */

import { sanitizeActionPatch } from "@/lib/actions/validate";
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

  try {
    const supabase = await createClient();
    let legacyTags: string[] = [];
    if (
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body) &&
      "context_tags" in body
    ) {
      const { data: existing, error: readError } = await supabase
        .from("actions")
        .select("context_tags")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (readError) {
        console.error("[api/actions PATCH] current tags read failed:", readError.message);
        return NextResponse.json(
          { error: "Failed to update the action. Please try again." },
          { status: 500 },
        );
      }
      if (!existing) {
        return NextResponse.json({ error: "Action not found." }, { status: 404 });
      }
      legacyTags = Array.isArray(existing.context_tags)
        ? existing.context_tags.filter((tag): tag is string => typeof tag === "string")
        : [];
    }

    const patch = sanitizeActionPatch(body, legacyTags);
    if (!patch) {
      return NextResponse.json(
        { error: "No valid action fields to update." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("actions")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[api/actions PATCH] update failed:", error.message);
      return NextResponse.json(
        { error: "Failed to update the action. Please try again." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Action not found." }, { status: 404 });
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/actions PATCH] threw:", message);
    return NextResponse.json(
      { error: "Failed to update the action. Please try again." },
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
      .from("actions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[api/actions DELETE] delete failed:", error.message);
      return NextResponse.json(
        { error: "Failed to delete the action. Please try again." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Action not found." }, { status: 404 });
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/actions DELETE] threw:", message);
    return NextResponse.json(
      { error: "Failed to delete the action. Please try again." },
      { status: 500 },
    );
  }
}
