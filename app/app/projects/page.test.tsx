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
  gt: (...args: unknown[]) => MockBuilder;
  range: (...args: unknown[]) => MockBuilder;
  maybeSingle: (...args: unknown[]) => MockBuilder;
  then: (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const mockState = vi.hoisted(() => ({
  calls: [] as { table: string; method: string; args: unknown[] }[],
  goalOptionsResults: [] as MockResult[],
  projectResults: [] as MockResult[],
  totalProjectsResult: null as MockResult | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const builder = {} as MockBuilder & Record<string, unknown>;
      for (const method of ["select", "order", "eq", "is", "or", "ilike", "gt", "range", "maybeSingle"]) {
        builder[method] = (...args: unknown[]) => {
          mockState.calls.push({ table, method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        mockState.calls.push({ table, method: "await", args: [] });
        const result: MockResult | null | undefined =
          table === "goals"
            ? mockState.goalOptionsResults.shift()
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
    mockState.goalOptionsResults = [{ data: GOALS, error: null }];
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
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).querySelector('[aria-current="page"]')).toHaveTextContent("Projects");
    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows all projects when no filter is supplied", async () => {
    await renderPage();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("Projects");
    expect(screen.getByText("Base training")).toBeInTheDocument();
    expect(screen.getByText("Write issue #1")).toBeInTheDocument();
    expect(screen.getByText("Standalone")).toBeInTheDocument();
  });

  it("filters to a specific goal and reflects the selection in the dropdown", async () => {
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
    mockState.goalOptionsResults = [{ data: GOALS, error: null }];
    await renderPage({ goal: "goal-does-not-exist" });

    expect(screen.getByText("Base training")).toBeInTheDocument();
    expect(screen.getByText("Write issue #1")).toBeInTheDocument();
    expect(screen.getByText("Standalone")).toBeInTheDocument();
    expect(
      (screen.getByRole("combobox", { name: "Filter by goal" }) as HTMLSelectElement)
        .value,
    ).toBe("all");
  });

  it("filters the loaded goal options in the browser", async () => {
    mockState.goalOptionsResults = [{ data: GOALS, error: null }];
    await renderPage({ goalQ: "marathon" });

    expect(screen.getByRole("option", { name: "All goals" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No goal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Run a marathon" })).toHaveAttribute(
      "href",
      "/app/projects?goal=goal-1",
    );
    expect(mockState.calls.filter((call) => call.table === "goals" && call.method === "await")).toHaveLength(1);
    expect(mockState.calls.some((call) => call.table === "goals" && call.method === "ilike")).toBe(false);
    expect(mockState.calls).toContainEqual({ table: "goals", method: "range", args: [0, 999] });
  });

  it("loads further goal batches with a stable ID cursor so every goal can be searched", async () => {
    const firstBatch = Array.from({ length: 1000 }, (_, index) => ({
      id: `goal-${index}`,
      goal_text: `Goal ${index}`,
    }));
    mockState.goalOptionsResults = [
      { data: firstBatch, error: null },
      { data: [{ id: "goal-last", goal_text: "Find this final goal" }], error: null },
    ];

    await renderPage({ goalQ: "final goal" });

    expect(screen.getByRole("link", { name: "Find this final goal" })).toBeInTheDocument();
    expect(
      mockState.calls
        .filter((call) => call.table === "goals" && call.method === "range")
        .map((call) => call.args),
    ).toEqual([[0, 999], [0, 999]]);
    expect(mockState.calls).toContainEqual({
      table: "goals",
      method: "gt",
      args: ["id", "goal-999"],
    });
    expect(mockState.calls.some((call) => call.table === "goals" && call.method === "ilike")).toBe(false);
  });

  it("keeps the project list usable when loading goal filter options fails", async () => {
    mockState.goalOptionsResults = [{ data: null, error: { message: "goals failed" } }];

    await renderPage();

    expect(screen.getByText("Base training")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Goal search is unavailable.");
    expect(screen.getByRole("searchbox", { name: "Search goals to filter projects" })).toBeDisabled();
  });

  it("keeps the project list usable when a later goal-options batch fails", async () => {
    const firstBatch = Array.from({ length: 1000 }, (_, index) => ({
      id: `goal-${index}`,
      goal_text: `Goal ${index}`,
    }));
    mockState.goalOptionsResults = [
      { data: firstBatch, error: null },
      { data: null, error: { message: "later goals batch failed" } },
    ];

    await renderPage({ goalQ: "not loaded" });

    expect(screen.getByText("Base training")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Goal search is unavailable.");
    expect(screen.queryByText(/No goals match/)).not.toBeInTheDocument();
  });

  it("loads goal options once and keeps All and No goal filters available", async () => {
    await renderPage();

    expect(screen.getByRole("option", { name: "All goals" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No goal" })).toBeInTheDocument();
    expect(mockState.calls.filter((call) => call.table === "goals" && call.method === "await")).toHaveLength(1);
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
    mockState.goalOptionsResults = [{ data: [...GOALS, { id: "goal-3", goal_text: "Empty goal" }], error: null }];
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
