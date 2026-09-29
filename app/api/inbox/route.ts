/**
 * Authenticated inbox capture endpoint (Story 5.1).
 *
 *   POST /api/inbox  — capture a raw thought as an `inbox_items` row.
 *
 * Capture stores raw text only: no classification, project, tag, or AI
 * processing at capture time (that is Story 5.2). The row is written for the
 * acting user; RLS also enforces ownership. Mirrors the auth/validation/error
 * shape of `app/api/actions/[id]/route.ts`.
 */

import { sanitizeInboxText } from "@/lib/inbox/validate";
import type { InboxItemInsert } from "@/lib/supabase/schema";
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
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
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

  const rawText = sanitizeInboxText(
    (body as { raw_text?: unknown } | null)?.raw_text,
  );
  if (rawText === null) {
    return NextResponse.json(
      { error: "Capture text must be between 1 and 2000 characters." },
      { status: 400 },
    );
  }

  const row: InboxItemInsert = { user_id: userId, raw_text: rawText };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("inbox_items")
      .insert(row)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[api/inbox POST] insert failed:", error.message);
      return NextResponse.json(
        { error: "Failed to capture the item. Please try again." },
        { status: 500 },
      );
    }
    if (!data) {
      console.error("[api/inbox POST] insert returned no row");
      return NextResponse.json(
        { error: "Failed to capture the item. Please try again." },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/inbox POST] threw:", message);
    return NextResponse.json(
      { error: "Failed to capture the item. Please try again." },
      { status: 500 },
    );
  }
}
