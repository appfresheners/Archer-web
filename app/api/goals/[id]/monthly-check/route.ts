import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let userId: string | null = null;
  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId || !supabase) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await _request.json();
  } catch {
    return NextResponse.json(
      { error: "A relevance answer is required." },
      { status: 400 },
    );
  }

  const relevance =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).relevance
      : null;
  if (relevance !== "yes" && relevance !== "no" && relevance !== "changed") {
    return NextResponse.json(
      { error: "Choose Yes, No, or Changed before completing the check." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const completedAt = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from("goals")
      .update({ last_checked_at: completedAt })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[api/goals monthly-check] update failed:", error.message);
      return NextResponse.json(
        { error: "Failed to complete the goal check. Please try again." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Goal not found." }, { status: 404 });
    }

    return NextResponse.json({ id: data.id, last_checked_at: completedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/goals monthly-check] threw:", message);
    return NextResponse.json(
      { error: "Failed to complete the goal check. Please try again." },
      { status: 500 },
    );
  }
}