import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }
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

  const orderedIds =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).orderedIds
      : undefined;
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === "string")) {
    return NextResponse.json(
      { error: "A complete ordered list of Area ids is required." },
      { status: 400 },
    );
  }
  const ids = orderedIds as string[];
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: "Duplicate Area ids in the reorder request." },
      { status: 400 },
    );
  }
  if (!ids.every((id) => UUID_PATTERN.test(id))) {
    return NextResponse.json(
      { error: "The reorder list contains an invalid Area id." },
      { status: 400 },
    );
  }

  try {
    const { error } = await supabase.rpc("reorder_areas_of_focus", {
      p_area_ids: ids,
    });
    if (error) {
      if ((error as { code?: string }).code === "22000") {
        return NextResponse.json(
          { error: "The reorder list must match your active Areas exactly." },
          { status: 400 },
        );
      }
      console.error("[api/areas/reorder PATCH] RPC failed:", error.message);
      return NextResponse.json(
        { error: "Failed to reorder Areas. Please try again." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/areas/reorder PATCH] threw:", message);
    return NextResponse.json(
      { error: "Failed to reorder Areas. Please try again." },
      { status: 500 },
    );
  }
}