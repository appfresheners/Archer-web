/**
 * Inbox (server component) inside the authenticated `/app` shell (Story 5.1).
 *
 * Loads the signed-in user's unprocessed items (RLS scopes every row to
 * `auth.uid()`), newest first, and renders the auto-focused capture form plus
 * the captured-items list. Processed items no longer appear in the inbox. Any
 * read failure degrades to an empty list rather than crashing the page. The
 * `/app` layout already enforces auth, so no auth check is repeated here.
 *
 * Capture stores raw text only — no classification. Processing/clarify is
 * Story 5.2.
 */

import InboxCaptureForm from "@/components/inbox/InboxCaptureForm";
import InboxList, { type InboxListItem } from "@/components/inbox/InboxList";
import ListSearch from "@/components/shared/ListSearch";
import Pagination from "@/components/shared/Pagination";
import ReadErrorState from "@/components/shared/ReadErrorState";
import {
  clampPage,
  escapeIlikePattern,
  getPageRange,
  LIST_PAGE_SIZE,
  parseListQuery,
  type ListSearchParams,
} from "@/lib/lists/search-pagination";
import type { ReadListResult } from "@/lib/read-result";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inbox — Archer",
};

interface LoadedInbox {
  items: InboxListItem[];
  query: string;
  page: number;
  total: number;
}

async function loadInboxItems(
  searchParams: ListSearchParams,
): Promise<ReadListResult<LoadedInbox>> {
  try {
    const supabase = await createClient();
    const { query, page: requestedPage } = parseListQuery(searchParams);
    const loadPage = (page: number) => {
      const { from, to } = getPageRange(page);
      let request = supabase
        .from("inbox_items")
        .select("id, raw_text, processing_status, captured_at", {
          count: "exact",
        })
        .eq("processing_status", "unprocessed");
      if (query) request = request.ilike("raw_text", escapeIlikePattern(query));
      return request
        .order("captured_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
    };

    let result = await loadPage(requestedPage);
    if (result.error || result.count == null) return { status: "error" };
    let total = result.count;
    let page = clampPage(requestedPage, total);
    if (page !== requestedPage) {
      result = await loadPage(page);
      if (result.error || result.count == null) return { status: "error" };
      if (result.count !== total) {
        total = result.count;
        const refreshedPage = clampPage(page, total);
        if (refreshedPage !== page) {
          page = refreshedPage;
          result = await loadPage(page);
          if (result.error || result.count == null) return { status: "error" };
          total = result.count;
        }
      }
    }

    return {
      status: "ok",
      data: {
        items: (result.data ?? []) as InboxListItem[],
        query,
        page,
        total,
      },
    };
  } catch {
    return { status: "error" };
  }
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const params = await searchParams;
  const result = await loadInboxItems(params);

  if (result.status === "error") {
    return <ReadErrorState />;
  }

  const { items, query, page, total } = result.data;

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <header className="flex flex-col gap-4">
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Inbox
        </h1>
        <InboxCaptureForm />
      </header>

      <ListSearch
        action="/app/inbox"
        label="Search Inbox"
        query={query}
        searchParams={params}
      />

      {query && total === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)] text-text-secondary">
          No matches for &apos;{query}&apos;.
        </p>
      ) : (
        <InboxList items={items} />
      )}

      <Pagination
        action="/app/inbox"
        page={page}
        total={total}
        pageSize={LIST_PAGE_SIZE}
        searchParams={params}
      />
    </section>
  );
}
