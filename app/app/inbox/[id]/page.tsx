/**
 * Clarify page (server component) inside the authenticated `/app` shell
 * (Story 5.2). Entry point from the Inbox "Process" button.
 *
 * Loads the single inbox item (RLS scopes it to the acting user). A missing,
 * non-owned, or already-terminal item renders as 404 via `notFound()` — you
 * only clarify an item that is still `unprocessed`. Also loads the user's
 * projects for the (optional) assign-to-project picker, then hands everything
 * to the client `ClarifyWizard`.
 *
 * The `/app` layout already enforces auth, so no auth check is repeated here.
 */

import ClarifyWizard from "@/components/inbox/clarify/ClarifyWizard";
import type { InboxProcessingStatus } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Clarify — Archer",
};

interface ClarifyPageProps {
  params: Promise<{ id: string }>;
}

interface LoadedItem {
  id: string;
  raw_text: string;
  processing_status: InboxProcessingStatus;
}

interface LoadResult {
  item: { id: string; raw_text: string };
  projects: { id: string; name: string }[];
}

async function loadClarifyData(id: string): Promise<LoadResult | null> {
  try {
    const supabase = await createClient();

    const { data: item, error } = await supabase
      .from("inbox_items")
      .select("id, raw_text, processing_status")
      .eq("id", id)
      .maybeSingle();

    if (error || !item) return null;

    const loaded = item as LoadedItem;
    // Only an unprocessed item is clarifiable; a terminal item is "not found"
    // for the purposes of this flow.
    if (loaded.processing_status !== "unprocessed") return null;

    const { data: projects } = await supabase
      .from("projects")
      .select("id, name")
      .order("sort_order", { ascending: true });

    return {
      item: { id: loaded.id, raw_text: loaded.raw_text },
      projects: (projects ?? []) as { id: string; name: string }[],
    };
  } catch {
    return null;
  }
}

export default async function ClarifyPage({ params }: ClarifyPageProps) {
  const { id } = await params;
  const result = await loadClarifyData(id);

  if (!result) {
    notFound();
  }

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Clarify
        </h1>
        <p className="text-text-secondary">
          Walk this item through the GTD clarify flow.
        </p>
      </header>

      <ClarifyWizard item={result.item} projects={result.projects} />
    </section>
  );
}
