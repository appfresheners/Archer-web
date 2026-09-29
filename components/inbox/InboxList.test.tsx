import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InboxList, { OVERDUE_FLAG_LABEL, type InboxListItem } from "./InboxList";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);

function isoDaysAgo(days: number): string {
  return new Date(NOW - days * DAY_MS).toISOString();
}

function mockFetch(ok = true, body: unknown = { id: "x" }, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function lastCall() {
  return (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
}

describe("InboxList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
    // Freeze "now" so the 7-day boundary is deterministic.
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the empty state 'Inbox zero.' for no items", () => {
    render(<InboxList items={[]} />);
    expect(screen.getByText("Inbox zero.")).toBeInTheDocument();
  });

  it("shows the amber flag for an unprocessed item captured > 7 days ago", () => {
    const items: InboxListItem[] = [
      {
        id: "old",
        raw_text: "Stale thought",
        processing_status: "unprocessed",
        captured_at: isoDaysAgo(8),
      },
    ];
    render(<InboxList items={items} />);
    expect(screen.getByText(OVERDUE_FLAG_LABEL)).toBeInTheDocument();
  });

  it("does NOT show the flag for an item captured exactly 7 days ago (boundary)", () => {
    const items: InboxListItem[] = [
      {
        id: "boundary",
        raw_text: "Right on the edge",
        processing_status: "unprocessed",
        captured_at: isoDaysAgo(7),
      },
    ];
    render(<InboxList items={items} />);
    expect(screen.queryByText(OVERDUE_FLAG_LABEL)).not.toBeInTheDocument();
    // The raw text still renders.
    expect(screen.getByText("Right on the edge")).toBeInTheDocument();
  });

  it("renders raw text and a capture timestamp for each row", () => {
    const items: InboxListItem[] = [
      {
        id: "a",
        raw_text: "Buy milk",
        processing_status: "unprocessed",
        captured_at: isoDaysAgo(1),
      },
    ];
    render(<InboxList items={items} />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    // A formatted (non-"Invalid Date") timestamp appears.
    expect(screen.queryByText("Invalid Date")).not.toBeInTheDocument();
  });

  it("issues DELETE /api/inbox/[id] and refreshes when Delete is clicked", async () => {
    const user = userEvent.setup();
    const items: InboxListItem[] = [
      {
        id: "del-1",
        raw_text: "Remove me",
        processing_status: "unprocessed",
        captured_at: isoDaysAgo(1),
      },
    ];
    render(<InboxList items={items} />);

    await user.click(screen.getByRole("button", { name: "Delete inbox item" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/inbox/del-1");
    expect(init.method).toBe("DELETE");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("surfaces an inline error when the delete fails", async () => {
    mockFetch(false, { error: "Failed to delete the item. Please try again." }, 500);
    const user = userEvent.setup();
    const items: InboxListItem[] = [
      {
        id: "del-2",
        raw_text: "Keep me around",
        processing_status: "unprocessed",
        captured_at: isoDaysAgo(1),
      },
    ];
    render(<InboxList items={items} />);

    await user.click(screen.getByRole("button", { name: "Delete inbox item" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to delete the item. Please try again.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
