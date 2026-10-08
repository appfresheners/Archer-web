import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "./page";
import {
  escapeIlikePattern,
  escapePostgrestFilterValue,
} from "@/lib/lists/search-pagination";

type MockResult = {
  data: unknown;
  count?: number | null;
  error: { message: string } | null;
};

type MockBuilder = {
  select: (...args: unknown[]) => MockBuilder;
  order: (...args: unknown[]) => MockBuilder;
  eq: (...args: unknown[]) => MockBuilder;
  is: (...args: unknown[]) => MockBuilder;
  or: (...args: unknown[]) => MockBuilder;
  ilike: (...args: unknown[]) => MockBuilder;
  range: (...args: unknown[]) => MockBuilder;
  maybeSingle: (...args: unknown[]) => MockBuilder;
  then: (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const mockState = vi.hoisted(() => ({
  calls: [] as { table: string; method: string; args: unknown[] }[],
  goalLookupResult: null as MockResult | null,
  goalSearchResults: [] as MockResult[],
  projectResults: [] as MockResult[],
  totalProjectsResult: null as MockResult | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const builder = {} as MockBuilder & Record<string, unknown>;
      let goalQuery: "lookup" | "search" = "lookup";
      for (const method of ["select", "order", "eq", "is", "or", "ilike", "range", "maybeSingle"]) {
        builder[method] = (...args: unknown[]) => {
          mockState.calls.push({ table, method, args });
          if (table === "goals" && method === "ilike") goalQuery = "search";
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        mockState.calls.push({ table, method: "await", args: [] });
        const result: MockResult | null | undefined =
          table === "goals"
            ? goalQuery === "search"
              ? mockState.goalSearchResults.shift()
              : mockState.goalLookupResult
            : table === "project_search"
              ? mockState.projectResults.shift()
              : mockState.totalProjectsResult;
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
  const ui = await ProjectsPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

const GOALS = [
  { id: "goal-1", goal_text: "Run a marathon" },
  { id: "goal-2", goal_text: "Launch a newsletter" },
];

const PROJECTS = [
  {
    id: "p1",
    name: "Base training",
    status: "active",
    goal_id: "goal-1",
    parent_goal_text: "Run a marathon",
  },
  {
    id: "p2",
    name: "Write issue #1",
    status: "active",
    goal_id: "goal-2",
    parent_goal_text: "Launch a newsletter",
  },
  {
    id: "p3",
    name: "Standalone",
    status: "paused",
    goal_id: null,
    parent_goal_text: null,
  },
];

describe("ProjectsPage", () => {
  beforeEach(() => {
    mockState.calls.length = 0;
    mockState.goalLookupResult = { data: null, error: null };
    mockState.goalSearchResults = [];
    mockState.projectResults = [{ data: PROJECTS, count: PROJECTS.length, error: null }];
    mockState.totalProjectsResult = {
      data: null,
      count: PROJECTS.length,
      error: null,
    };
  });

  it("renders an error state when a read errors", async () => {
    mockState.projectResults = [{ data: null, count: null, error: { message: "boom" } }];
    await renderPage();
    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows all projects when no filter is supplied", async () => {
    await renderPage();

    expect(screen.getByText("Base training")).toBeInTheDocument();
    expect(screen.getByText("Write issue #1")).toBeInTheDocument();
    expect(screen.getByText("Standalone")).toBeInTheDocument();
  });

  it("filters to a specific goal and reflects the selection in the dropdown", async () => {
    mockState.goalLookupResult = { data: GOALS[1], error: null };
    mockState.projectResults = [
      { data: [PROJECTS[1]], count: 1, error: null },
    ];
    await renderPage({ goal: "goal-2" });

    expect(screen.getByText("Write issue #1")).toBeInTheDocument();
    expect(screen.queryByText("Base training")).not.toBeInTheDocument();
    expect(screen.queryByText("Standalone")).not.toBeInTheDocument();

    // The dropdown is the single control; its value mirrors the URL filter.
    const select = screen.getByRole("combobox", {
      name: "Filter by goal",
    }) as HTMLSelectElement;
    expect(select.value).toBe("goal-2");
    expect(
      screen.getByRole("option", { name: "Launch a newsletter" }),
    ).toBeInTheDocument();
    expect(
      mockState.calls.some(
        (call) => call.table === "project_search" && call.method === "eq" && call.args[0] === "goal_id" && call.args[1] === "goal-2",
      ),
    ).toBe(true);
  });

  it("filters to goal-less projects via ?goal=none", async () => {
    mockState.projectResults = [
      { data: [PROJECTS[2]], count: 1, error: null },
    ];
    await renderPage({ goal: "none" });

    expect(screen.getByText("Standalone")).toBeInTheDocument();
    expect(screen.queryByText("Base training")).not.toBeInTheDocument();
    expect(screen.queryByText("Write issue #1")).not.toBeInTheDocument();
    expect(
      (screen.getByRole("combobox", { name: "Filter by goal" }) as HTMLSelectElement)
        .value,
    ).toBe("none");
    expect(
      mockState.calls.some(
        (call) => call.table === "project_search" && call.method === "is" && call.args[0] === "goal_id" && call.args[1] === null,
      ),
    ).toBe(true);
  });

  it("falls back to All for an unknown goal filter", async () => {
    await renderPage({ goal: "goal-does-not-exist" });

    expect(screen.getByText("Base training")).toBeInTheDocument();
    expect(screen.getByText("Write issue #1")).toBeInTheDocument();
    expect(screen.getByText("Standalone")).toBeInTheDocument();
    expect(
      (screen.getByRole("combobox", { name: "Filter by goal" }) as HTMLSelectElement)
        .value,
    ).toBe("all");
  });

  it("searches bounded goal options instead of loading all goals", async () => {
    mockState.goalSearchResults = [{ data: [GOALS[0]], count: 1, error: null }];
    await renderPage({ goalQ: "marathon" });

    expect(screen.getByRole("option", { name: "All goals" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No goal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Run a marathon" })).toHaveAttribute(
      "href",
      "/app/projects?goal=goal-1",
    );
    expect(mockState.calls).toContainEqual({
      table: "goals",
      method: "ilike",
      args: ["goal_text", "%marathon%"],
    });
    expect(mockState.calls).toContainEqual({
      table: "goals",
      method: "range",
      args: [0, 19],
    });
    expect(
      mockState.calls.some(
        (call) =>
          call.table === "goals" &&
          call.method === "select" &&
          (call.args[1] as { count?: string })?.count === "exact",
      ),
    ).toBe(true);
  });

  it("keeps All and No goal filters available without reading the Goals table", async () => {
    await renderPage();

    expect(screen.getByRole("option", { name: "All goals" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No goal" })).toBeInTheDocument();
    expect(mockState.calls.some((call) => call.table === "goals")).toBe(false);
    expect(screen.getByText("Base training")).toBeInTheDocument();
  });

  it("shows the goal name under a linked project", async () => {
    await renderPage();

    expect(screen.getByText("Base training").closest("li")).toHaveTextContent(
      "Run a marathon",
    );
    expect(screen.getByText("Write issue #1").closest("li")).toHaveTextContent(
      "Launch a newsletter",
    );
  });

  it("shows the empty state when there are no projects at all", async () => {
    mockState.projectResults = [{ data: [], count: 0, error: null }];
    await renderPage();

    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
  });

  it("shows a no-match message when the filter excludes every project", async () => {
    mockState.goalLookupResult = {
      data: { id: "goal-3", goal_text: "Empty goal" },
      error: null,
    };
    mockState.projectResults = [{ data: [], count: 0, error: null }];

    await renderPage({ goal: "goal-3" });

    expect(screen.getByText("No projects match this filter.")).toBeInTheDocument();
  });

  it("uses exact-count ranged search across project and parent-goal text", async () => {
    const query = "Forest%_\\";
    await renderPage({ q: query });

    expect(screen.getByRole("searchbox", { name: "Search Projects" })).toHaveValue(
      query,
    );
    const filterCall = mockState.calls.find(
      (call) => call.table === "project_search" && call.method === "or",
    );
    const escapedPattern = escapePostgrestFilterValue(escapeIlikePattern(query));
    expect(filterCall?.args[0]).toBe(
      `name.ilike."${escapedPattern}",parent_goal_text.ilike."${escapedPattern}"`,
    );
    expect(
      mockState.calls.some(
        (call) =>
          call.table === "project_search" &&
          call.method === "select" &&
          (call.args[1] as { count?: string })?.count === "exact",
      ),
    ).toBe(true);
    expect(
      mockState.calls.some(
        (call) => call.table === "project_search" && call.method === "range" && call.args[0] === 0 && call.args[1] === 19,
      ),
    ).toBe(true);
    expect(mockState.calls).toContainEqual({
      table: "project_search",
      method: "order",
      args: ["id", { ascending: true }],
    });
  });

  it("refetches the last valid page when the requested page is too high", async () => {
    mockState.projectResults = [
      { data: [], count: 45, error: null },
      { data: [PROJECTS[2]], count: 45, error: null },
    ];

    await renderPage({ page: "9" });

    expect(screen.getByText("Showing 41-45 of 45")).toBeInTheDocument();
    expect(
      mockState.calls.filter((call) => call.table === "project_search" && call.method === "range").map((call) => call.args),
    ).toEqual([[160, 179], [40, 59]]);
  });

  it("reclamps if the result count shrinks during the last-page refetch", async () => {
    mockState.projectResults = [
      { data: [], count: 45, error: null },
      { data: [], count: 35, error: null },
      { data: [PROJECTS[2]], count: 35, error: null },
    ];

    await renderPage({ page: "9" });

    expect(screen.getByText("Showing 21-35 of 35")).toBeInTheDocument();
    expect(
      mockState.calls.filter((call) => call.table === "project_search" && call.method === "range").map((call) => call.args),
    ).toEqual([[160, 179], [40, 59], [20, 39]]);
  });

  it("treats a missing exact count as a read error", async () => {
    mockState.projectResults = [{ data: [], count: null, error: null }];

    await renderPage();

    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
  });

  it("distinguishes a search with no matches from an empty list", async () => {
    mockState.projectResults = [{ data: [], count: 0, error: null }];

    await renderPage({ q: "missing" });

    expect(screen.getByText("No matches for 'missing'.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/app/projects",
    );
    expect(screen.queryByText("No projects yet.")).not.toBeInTheDocument();
  });
});
