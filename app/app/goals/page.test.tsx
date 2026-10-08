import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoalsPage from "./page";

type MockResult = {
  data: unknown;
  count?: number | null;
  error: { message: string } | null;
};

type MockBuilder = {
  select: (...args: unknown[]) => MockBuilder;
  order: (...args: unknown[]) => MockBuilder;
  ilike: (...args: unknown[]) => MockBuilder;
  range: (...args: unknown[]) => MockBuilder;
  in: (...args: unknown[]) => MockBuilder;
  then: (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const mockState = vi.hoisted(() => ({
  calls: [] as { table: string; method: string; args: unknown[] }[],
  goalsResults: [] as MockResult[],
  projectsResult: null as MockResult | null,
  actionsResult: null as MockResult | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const builder = {} as MockBuilder & Record<string, unknown>;
      for (const method of ["select", "order", "ilike", "range", "in"]) {
        builder[method] = (...args: unknown[]) => {
          mockState.calls.push({ table, method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        mockState.calls.push({ table, method: "await", args: [] });
        const result: MockResult | null =
          table === "goals"
            ? mockState.goalsResults.shift() ?? null
            : table === "projects"
              ? mockState.projectsResult
              : mockState.actionsResult;
        return Promise.resolve(result).then(resolve, reject);
      };
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
  const ui = await GoalsPage({ searchParams: Promise.resolve(searchParams) });
  return render(ui);
}

describe("GoalsPage", () => {
  beforeEach(() => {
    mockState.calls.length = 0;
    mockState.goalsResults = [{ data: [], count: 0, error: null }];
    mockState.projectsResult = { data: [], error: null };
    mockState.actionsResult = { data: [], error: null };
  });

  it("shows the empty state with a wizard link when there are no goals", async () => {
    await renderPage();

    expect(screen.getByText("No goals yet. Start one.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "New goal" });
    expect(link).toHaveAttribute("href", "/app/goals/new");
  });

  it("renders an error state when the goals query errors", async () => {
    mockState.goalsResults = [{ data: null, count: null, error: { message: "boom" } }];

    await renderPage();

    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders goal rows sorted Active-first with badge, counts, and chevron link", async () => {
    mockState.goalsResults = [{
      data: [
        {
          id: "g-active",
          goal_text: "Learn to run a marathon",
          status: "active",
          target_date: "2026-12-31",
          created_at: "2026-02-01T00:00:00Z",
        },
        {
          id: "g-completed",
          goal_text: "Ship the archive feature",
          status: "completed",
          target_date: "2026-03-15",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      count: 2,
      error: null,
    }];
    mockState.projectsResult = {
      data: [
        { id: "p1", goal_id: "g-active", status: "active" },
        { id: "p2", goal_id: "g-active", status: "active" },
        { id: "p3", goal_id: "g-completed", status: "completed" },
      ],
      error: null,
    };
    mockState.actionsResult = {
      data: [
        // p1 has a committed action → not stuck; p2 has none → stuck.
        { project_id: "p1", status: "committed" },
        { project_id: "p2", status: "available" },
      ],
      error: null,
    };

    await renderPage();

    const links = screen.getAllByRole("link");
    // Header "New goal" + two goal rows.
    const rowLinks = links.filter((l) =>
      l.getAttribute("href")?.startsWith("/app/goals/g-"),
    );
    expect(rowLinks.map((l) => l.getAttribute("href"))).toEqual([
      "/app/goals/g-active",
      "/app/goals/g-completed",
    ]);

    expect(screen.getByText("Learn to run a marathon")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    // g-active has 2 projects; one is stuck.
    expect(screen.getByText("2 projects")).toBeInTheDocument();
    expect(screen.getByText("1 stuck project")).toBeInTheDocument();

    // The header "New goal" control is present (and points at the wizard) when
    // goals exist — not only in the empty state.
    const headerNewGoal = links.find(
      (l) =>
        l.getAttribute("href") === "/app/goals/new" &&
        l.textContent === "New goal",
    );
    expect(headerNewGoal).toBeDefined();

    expect(
      mockState.calls.some(
        (call) => call.table === "goals" && call.method === "order" && call.args[0] === "status",
      ),
    ).toBe(true);
    expect(mockState.calls).toContainEqual({
      table: "goals",
      method: "order",
      args: ["status", { ascending: true }],
    });
    expect(mockState.calls).toContainEqual({
      table: "goals",
      method: "order",
      args: ["created_at", { ascending: false }],
    });
    expect(mockState.calls).toContainEqual({
      table: "goals",
      method: "order",
      args: ["id", { ascending: true }],
    });
    expect(
      mockState.calls.some(
        (call) => call.table === "projects" && call.method === "in" && call.args[0] === "goal_id" && (call.args[1] as string[]).length === 2,
      ),
    ).toBe(true);
    expect(
      mockState.calls.some(
        (call) => call.table === "actions" && call.method === "in" && call.args[0] === "project_id" && (call.args[1] as string[]).length === 3,
      ),
    ).toBe(true);
  });

  it("searches goal text with exact-count paging and distinguishes no matches", async () => {
    mockState.goalsResults = [{ data: [], count: 0, error: null }];

    await renderPage({ q: "marathon" });

    expect(screen.getByText("No matches for 'marathon'.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toBeInTheDocument();
    expect(
      mockState.calls.some((call) => call.table === "goals" && call.method === "ilike" && call.args[0] === "goal_text"),
    ).toBe(true);
    expect(
      mockState.calls.some(
        (call) => call.table === "goals" && call.method === "select" && (call.args[1] as { count?: string })?.count === "exact",
      ),
    ).toBe(true);
    expect(
      mockState.calls.some(
        (call) => call.table === "goals" && call.method === "range" && call.args[0] === 0 && call.args[1] === 19,
      ),
    ).toBe(true);
  });

  it("loads supporting records only for the clamped page of goals", async () => {
    const currentGoal = {
      id: "g-page-2",
      goal_text: "Current page goal",
      status: "active",
      target_date: "2026-12-31",
      created_at: "2026-02-01T00:00:00Z",
    };
    mockState.goalsResults = [
      { data: [], count: 45, error: null },
      { data: [], count: 35, error: null },
      { data: [currentGoal], count: 35, error: null },
    ];

    await renderPage({ page: "9" });

    expect(screen.getByText("Current page goal")).toBeInTheDocument();
    expect(
      mockState.calls.filter((call) => call.table === "goals" && call.method === "range").map((call) => call.args),
    ).toEqual([[160, 179], [40, 59], [20, 39]]);
    expect(
      mockState.calls.find((call) => call.table === "projects" && call.method === "in")?.args,
    ).toEqual(["goal_id", ["g-page-2"]]);
    expect(screen.getByText("Showing 21-35 of 35")).toBeInTheDocument();
  });

  it("treats a missing exact count as a read error", async () => {
    mockState.goalsResults = [{ data: [], count: null, error: null }];

    await renderPage();

    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
  });

  it("renders a read error when the supporting project query fails", async () => {
    const goal = {
      id: "g-support",
      goal_text: "Supporting reads",
      status: "active",
      target_date: "2026-12-31",
      created_at: "2026-02-01T00:00:00Z",
    };
    mockState.goalsResults = [{ data: [goal], count: 1, error: null }];
    mockState.projectsResult = { data: null, error: { message: "projects failed" } };

    await renderPage();
    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
  });

  it("renders a read error when the supporting action query fails", async () => {
    const goal = {
      id: "g-support",
      goal_text: "Supporting reads",
      status: "active",
      target_date: "2026-12-31",
      created_at: "2026-02-01T00:00:00Z",
    };
    mockState.goalsResults = [{ data: [goal], count: 1, error: null }];
    mockState.projectsResult = {
      data: [{ id: "p-support", goal_id: "g-support", status: "active" }],
      error: null,
    };
    mockState.actionsResult = { data: null, error: { message: "actions failed" } };

    await renderPage();
    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
  });
});
