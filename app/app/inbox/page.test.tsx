import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InboxPage from "./page";

type MockResult = {
  data: unknown;
  count?: number | null;
  error: { message: string } | null;
};

type MockBuilder = {
  select: (...args: unknown[]) => MockBuilder;
  eq: (...args: unknown[]) => MockBuilder;
  ilike: (...args: unknown[]) => MockBuilder;
  order: (...args: unknown[]) => MockBuilder;
  range: (...args: unknown[]) => MockBuilder;
  then: (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const mockState = vi.hoisted(() => ({
  calls: [] as { method: string; args: unknown[] }[],
  results: [] as MockResult[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const builder = {} as MockBuilder & Record<string, unknown>;
      for (const method of ["select", "eq", "ilike", "order", "range"]) {
        builder[method] = (...args: unknown[]) => {
          mockState.calls.push({ method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(mockState.results.shift()).then(resolve, reject);
      return builder;
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

async function renderPage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  const ui = await InboxPage({ searchParams: Promise.resolve(searchParams) });
  return render(ui);
}

const ITEMS = [
  {
    id: "inbox-1",
    raw_text: "Plan forest walk",
    processing_status: "unprocessed",
    captured_at: "2026-10-07T10:00:00Z",
  },
];

describe("InboxPage", () => {
  beforeEach(() => {
    mockState.calls.length = 0;
    mockState.results = [{ data: ITEMS, count: 1, error: null }];
  });

  it("searches unprocessed raw text with exact-count newest-first pagination", async () => {
    await renderPage({ q: "forest" });

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("Inbox");
    expect(screen.getByText("Plan forest walk")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search Inbox" })).toHaveValue(
      "forest",
    );
    expect(mockState.calls).toContainEqual({
      method: "eq",
      args: ["processing_status", "unprocessed"],
    });
    expect(mockState.calls).toContainEqual({ method: "ilike", args: ["raw_text", "%forest%"] });
    expect(mockState.calls).toContainEqual({
      method: "select",
      args: [
        "id, raw_text, processing_status, captured_at",
        { count: "exact" },
      ],
    });
    expect(mockState.calls).toContainEqual({ method: "range", args: [0, 19] });
    expect(mockState.calls).toContainEqual({
      method: "order",
      args: ["captured_at", { ascending: false }],
    });
    expect(mockState.calls).toContainEqual({
      method: "order",
      args: ["id", { ascending: true }],
    });
  });

  it("shows the existing true-empty state", async () => {
    mockState.results = [{ data: [], count: 0, error: null }];

    await renderPage();

    expect(screen.getByText("Inbox zero.")).toBeInTheDocument();
  });

  it("shows no matches and a clear-search link instead of the empty state", async () => {
    mockState.results = [{ data: [], count: 0, error: null }];

    await renderPage({ q: "missing" });

    expect(screen.getByText("No matches for 'missing'.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/app/inbox",
    );
    expect(screen.queryByText("Inbox zero.")).not.toBeInTheDocument();
  });

  it("clamps an excessive page and refetches the last page", async () => {
    mockState.results = [
      { data: [], count: 45, error: null },
      { data: [], count: 35, error: null },
      { data: ITEMS, count: 35, error: null },
    ];

    await renderPage({ page: "9" });

    expect(screen.getByText("Showing 21-35 of 35")).toBeInTheDocument();
    expect(mockState.calls.filter((call) => call.method === "range").map((call) => call.args)).toEqual([
      [160, 179],
      [40, 59],
      [20, 39],
    ]);
  });

  it("treats a missing exact count as a read error", async () => {
    mockState.results = [{ data: [], count: null, error: null }];

    await renderPage();

    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).querySelector('[aria-current="page"]')).toHaveTextContent("Inbox");
    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
  });

  it("renders a read error rather than an empty state", async () => {
    mockState.results = [{ data: null, count: null, error: { message: "boom" } }];

    await renderPage();

    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});