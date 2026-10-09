import { sanitizeAreaInput } from "@/lib/focus/validate";
import type { AreaOfFocusInsert } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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

  const area = sanitizeAreaInput(body);
  if (!area) {
    return NextResponse.json(
      { error: "Area name or description is invalid." },
      { status: 400 },
    );
  }

  try {
    const { data: latestAreas, error: orderError } = await supabase
      .from("areas_of_focus")
      .select("sort_order")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (orderError) {
      console.error("[api/areas POST] order read failed:", orderError.message);
      return NextResponse.json(
        { error: "Failed to create the Area. Please try again." },
        { status: 500 },
      );
    }

    const sortOrder = latestAreas?.[0]?.sort_order ?? -1;
    const row: AreaOfFocusInsert = {
      user_id: userId,
      ...area,
      sort_order: sortOrder + 1,
    };
    const { data, error } = await supabase
      .from("areas_of_focus")
      .insert(row)
      .select("id")
      .single();

    if (error || !data) {
      console.error(
        "[api/areas POST] insert failed:",
        error?.message ?? "no row",
      );
      return NextResponse.json(
        { error: "Failed to create the Area. Please try again." },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/areas POST] threw:", message);
    return NextResponse.json(
      { error: "Failed to create the Area. Please try again." },
      { status: 500 },
    );
  }
}