import { sanitizeAreaInput } from "@/lib/focus/validate";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }
    userId = data.user.id;
  } catch {
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

  const { id } = await context.params;
  const action =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).action
      : undefined;

  let patch: { name?: string; description?: string | null; archived_at?: string | null; sort_order?: number };
  if (action === "archive") {
    patch = { archived_at: new Date().toISOString() };
  } else if (action === "restore") {
    try {
      const { data: activeAreas, error: orderError } = await supabase
        .from("areas_of_focus")
        .select("sort_order")
        .eq("user_id", userId)
        .is("archived_at", null)
        .order("sort_order", { ascending: false })
        .limit(1);

      if (orderError) {
        console.error("[api/areas/[id] PATCH] restore order read failed:", orderError.message);
        return NextResponse.json(
          { error: "Failed to restore the Area. Please try again." },
          { status: 500 },
        );
      }

      patch = {
        archived_at: null,
        sort_order: (activeAreas?.[0]?.sort_order ?? -1) + 1,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unexpected error";
      console.error("[api/areas/[id] PATCH] restore order read threw:", message);
      return NextResponse.json(
        { error: "Failed to restore the Area. Please try again." },
        { status: 500 },
      );
    }
  } else {
    const area = sanitizeAreaInput(body);
    if (!area) {
      return NextResponse.json(
        { error: "Area name or description is invalid." },
        { status: 400 },
      );
    }
    patch = area;
  }

  try {
    let query = supabase
      .from("areas_of_focus")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId);
    if (action === "restore") {
      query = query.not("archived_at", "is", null);
    }
    const { data, error } = await query.select("id").maybeSingle();

    if (error) {
      console.error("[api/areas/[id] PATCH] update failed:", error.message);
      return NextResponse.json(
        { error: "Failed to update the Area. Please try again." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Area not found." }, { status: 404 });
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/areas/[id] PATCH] threw:", message);
    return NextResponse.json(
      { error: "Failed to update the Area. Please try again." },
      { status: 500 },
    );
  }
}