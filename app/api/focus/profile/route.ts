import { sanitizeFocusProfile } from "@/lib/focus/validate";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
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

  const profile = sanitizeFocusProfile(body);
  if (!profile) {
    return NextResponse.json(
      { error: "Profile fields are invalid." },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("focus_profiles")
      .upsert({ user_id: userId, ...profile }, { onConflict: "user_id" })
      .select("id")
      .single();

    if (error || !data) {
      console.error(
        "[api/focus/profile PUT] upsert failed:",
        error?.message ?? "no row",
      );
      return NextResponse.json(
        { error: "Failed to save your Focus profile. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/focus/profile PUT] threw:", message);
    return NextResponse.json(
      { error: "Failed to save your Focus profile. Please try again." },
      { status: 500 },
    );
  }
}