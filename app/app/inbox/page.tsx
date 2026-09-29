/**
 * Inbox (server component) inside the authenticated `/app` shell (Story 5.1).
 *
 * Loads the signed-in user's captured items (RLS scopes every row to
 * `auth.uid()`), newest first, and renders the auto-focused capture form plus
 * the captured-items list. Any read failure degrades to an empty list rather
 * than crashing the page. The `/app` layout already enforces auth, so no auth
 * check is repeated here.
 *
 * Capture stores raw text only — no classification. Processing/clarify is
 * Story 5.2.
 */

import InboxCaptureForm from "@/components/inbox/InboxCaptureForm";
import InboxList, { type InboxListItem } from "@/components/inbox/InboxList";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inbox — Archer",
};

/**
 * Load the user's inbox items, newest capture first. Trashed items never
 * appear (delete hard-removes the row at the capture stage). Returns an empty
 * list on any failure so the page always renders.
 */
async function loadInboxItems(): Promise<InboxListItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("inbox_items")
      .select("id, raw_text, processing_status, captured_at")
      .neq("processing_status", "trashed")
      .order("captured_at", { ascending: false });

    if (error || !data) return [];
    return data as InboxListItem[];
  } catch {
    return [];
  }
}

export default async function InboxPage() {
  const items = await loadInboxItems();

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <header className="flex flex-col gap-4">
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Inbox
        </h1>
        <InboxCaptureForm />
      </header>

      <InboxList items={items} />
    </section>
  );
}
