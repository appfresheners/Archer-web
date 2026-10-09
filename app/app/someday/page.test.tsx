import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  escapeIlikePattern,
  escapePostgrestFilterValue,
} from "@/lib/lists/search-pagination";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SomedayPage from "./page";

type MockResult = {
  data: unknown;
  count?: number | null;
  error: { message: string } | null;
};

type MockBuilder = {
  select: (...args: unknown[]) => MockBuilder;
  eq: (...args: unknown[]) => MockBuilder;
  ilike: (...args: unknown[]) => MockBuilder;
  or: (...args: unknown[]) => MockBuilder;
  order: (...args: unknown[]) => MockBuilder;
  range: (...args: unknown[]) => MockBuilder;
  then: (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const mockState = vi.hoisted(() => ({
  calls: [] as { table: string; method: string; args: unknown[] }[],
  results: {} as Record<string, MockResult[]>,
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const builder = {} as MockBuilder & Record<string, unknown>;
      for (const method of ["select", "eq", "ilike", "or", "order", "range"]) {
        builder[method] = (...args: unknown[]) => {
          mockState.calls.push({ table, method, args });
          return builder;
        };
      }
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(mockState.results[table]?.shift()).then(resolve, reject);
      return builder;
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockState.refresh }),
}));

async function renderPage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  const ui = await SomedayPage({ searchParams: Promise.resolve(searchParams) });
  return render(ui);
}

const ITEMS = [
  {
    id: "item-1",
    raw_text: "Learn pottery",
    processing_status: "someday",
    captured_at: "2026-10-07T10:00:00Z",
  },
];

const PROJECTS = [
  {
    id: "project-1",
    name: "Build a kiln",
    status: "someday",
    goal_id: "goal-1",
    parent_goal_text: "Learn pottery",
    created_at: "2026-10-07T10:00:00Z",
  },
];

const GOALS = [
  {
    id: "goal-1",
    goal_text: "Learn pottery",
    status: "someday",
    created_at: "2026-10-07T10:00:00Z",
  },
];

function setupResults() {
  mockState.results = {
    inbox_items: [{ data: ITEMS, count: 1, error: null }],
    project_search: [{ data: PROJECTS, count: 1, error: null }],
    goals: [{ data: GOALS, count: 1, error: null }],
  };
}

describe("SomedayPage", () => {
  beforeEach(() => {
    mockState.calls.length = 0;
    mockState.refresh.mockReset();
    setupResults();
  });

  it("loads Someday-only sections with exact counts and links to existing details", async () => {
    await renderPage();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("Someday");
    expect(screen.getByRole("heading", { name: "Parked items (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Someday projects (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Someday goals (1)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Build a kiln" })).toHaveAttribute(
      "href",
      "/app/projects/project-1",
    );
    expect(screen.getByRole("link", { name: /Learn pottery/ })).toHaveAttribute(
      "href",
      "/app/goals/goal-1",
    );

    expect(mockState.calls).toContainEqual({
      table: "inbox_items",
      method: "eq",
      args: ["processing_status", "someday"],
    });
    expect(mockState.calls).toContainEqual({
      table: "project_search",
      method: "eq",
      args: ["status", "someday"],
    });
    expect(mockState.calls).toContainEqual({
      table: "goals",
      method: "eq",
      args: ["status", "someday"],
    });
    for (const table of ["inbox_items", "project_search", "goals"]) {
      expect(
        mockState.calls.some(
          (call) =>
            call.table === table &&
            call.method === "select" &&
            (call.args[1] as { count?: string })?.count === "exact",
        ),
      ).toBe(true);
      expect(
        mockState.calls.some(
          (call) => call.table === table && call.method === "order" && call.args[0] === "id",
        ),
      ).toBe(true);
      expect(
        mockState.calls.some(
          (call) => call.table === table && call.method === "range" && call.args[0] === 0 && call.args[1] === 19,
        ),
      ).toBe(true);
    }

    const expectedOrder = {
      inbox_items: [
        ["captured_at", { ascending: false }],
        ["id", { ascending: true }],
      ],
      project_search: [
        ["created_at", { ascending: false }],
        ["id", { ascending: true }],
      ],
      goals: [
        ["created_at", { ascending: false }],
        ["id", { ascending: true }],
      ],
    };
    for (const [table, order] of Object.entries(expectedOrder)) {
      expect(
        mockState.calls
          .filter((call) => call.table === table && call.method === "order")
          .map((call) => [call.args[0], call.args[1]]),
      ).toEqual(order);
    }
  });

  it("uses independent escaped searches and page keys for each section", async () => {
    const query = "100%_\\";
    const projectQuery = ["kiln", "%", "_", "\\", '"'].join("");
    const goalQuery = "pottery%_";
    mockState.results = {
      inbox_items: [
        { data: ITEMS, count: 100, error: null },
        { data: ITEMS, count: 100, error: null },
      ],
      project_search: [
        { data: PROJECTS, count: 100, error: null },
        { data: PROJECTS, count: 100, error: null },
      ],
      goals: [
        { data: GOALS, count: 100, error: null },
        { data: GOALS, count: 100, error: null },
      ],
    };
    await renderPage({
      q_items: query,
      page_items: "2",
      q_projects: projectQuery,
      page_projects: "3",
      q_goals: goalQuery,
      page_goals: "4",
    });

    expect(screen.getByRole("searchbox", { name: "Search parked items" })).toHaveValue(query);
    expect(screen.getByRole("searchbox", { name: "Search Someday projects" })).toHaveValue(projectQuery);
    expect(screen.getByRole("searchbox", { name: "Search Someday goals" })).toHaveValue(goalQuery);
    expect(mockState.calls).toContainEqual({
      table: "inbox_items",
      method: "ilike",
      args: ["raw_text", "%100\\%\\_\\\\%"],
    });
    expect(mockState.calls).toContainEqual({
      table: "project_search",
      method: "or",
      args: [
        `name.ilike."${escapePostgrestFilterValue(escapeIlikePattern(projectQuery))}",parent_goal_text.ilike."${escapePostgrestFilterValue(escapeIlikePattern(projectQuery))}"`,
      ],
    });
    expect(mockState.calls).toContainEqual({
      table: "goals",
      method: "ilike",
      args: ["goal_text", "%pottery\\%\\_%"],
    });
    expect(mockState.calls).toContainEqual({ table: "inbox_items", method: "range", args: [20, 39] });
    expect(mockState.calls).toContainEqual({ table: "project_search", method: "range", args: [40, 59] });
    expect(mockState.calls).toContainEqual({ table: "goals", method: "range", args: [60, 79] });

    const itemForm = screen.getByRole("searchbox", { name: "Search parked items" }).closest("form");
    expect(itemForm?.querySelector('[name="q_projects"]')).toHaveValue(projectQuery);
    expect(itemForm?.querySelector('[name="page_projects"]')).toHaveValue("3");
    expect(itemForm?.querySelector('[name="q_goals"]')).toHaveValue(goalQuery);
    expect(itemForm?.querySelector('[name="page_goals"]')).toHaveValue("4");

    const sections = [
      ["Parked items (100)", "page_items"],
      ["Someday projects (100)", "page_projects"],
      ["Someday goals (100)", "page_goals"],
    ] as const;
    for (const [sectionName, currentPageKey] of sections) {
      const section = screen.getByRole("region", { name: sectionName });
      const pageLink = within(section).getByRole("link", { name: "Go to page 5" });
      const url = new URL(pageLink.getAttribute("href")!, "http://localhost");
      expect(url.searchParams.get(currentPageKey)).toBe("5");
      expect(url.searchParams.get("page_items")).toBe(
        currentPageKey === "page_items" ? "5" : "2",
      );
      expect(url.searchParams.get("page_projects")).toBe(
        currentPageKey === "page_projects" ? "5" : "3",
      );
      expect(url.searchParams.get("page_goals")).toBe(
        currentPageKey === "page_goals" ? "5" : "4",
      );
    }
  });

  it("clamps an excessive page independently and refetches the last page", async () => {
    mockState.results.inbox_items = [
      { data: [], count: 45, error: null },
      { data: ITEMS, count: 45, error: null },
    ];
    mockState.results.project_search = [
      { data: [], count: 0, error: null },
      { data: [], count: 0, error: null },
    ];
    mockState.results.goals = [
      { data: [], count: 0, error: null },
      { data: [], count: 0, error: null },
    ];

    await renderPage({ page_items: "9", page_projects: "3", page_goals: "7" });

    expect(screen.getByText("Showing 41-45 of 45")).toBeInTheDocument();
    expect(
      mockState.calls
        .filter((call) => call.table === "inbox_items" && call.method === "range")
        .map((call) => call.args),
    ).toEqual([[160, 179], [40, 59]]);
    expect(
      mockState.calls
        .filter((call) => call.table === "project_search" && call.method === "range")
        .map((call) => call.args),
    ).toEqual([[40, 59], [0, 19]]);
    expect(
      mockState.calls
        .filter((call) => call.table === "goals" && call.method === "range")
        .map((call) => call.args),
    ).toEqual([[120, 139], [0, 19]]);
  });

  it("re-clamps when counts shrink again during the page refetch", async () => {
    mockState.results.inbox_items = [
      { data: [], count: 60, error: null },
      { data: [], count: 40, error: null },
      { data: [], count: 20, error: null },
      { data: ITEMS, count: 20, error: null },
    ];

    await renderPage({ page_items: "9" });

    expect(screen.getByText("Showing 1-20 of 20")).toBeInTheDocument();
    expect(
      mockState.calls
        .filter((call) => call.table === "inbox_items" && call.method === "range")
        .map((call) => call.args),
    ).toEqual([[160, 179], [40, 59], [20, 39], [0, 19]]);
  });

  it("distinguishes true empty sections from a section with no search matches", async () => {
    mockState.results.inbox_items = [{ data: [], count: 0, error: null }];
    mockState.results.project_search = [{ data: PROJECTS, count: 1, error: null }];
    mockState.results.goals = [{ data: [], count: 0, error: null }];

    await renderPage({ q_items: "missing" });

    expect(screen.getByText("No matches for 'missing'.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/app/someday",
    );
    expect(screen.getByText("Build a kiln")).toBeInTheDocument();
    expect(screen.getByText("No Someday goals.")).toBeInTheDocument();
    expect(screen.queryByText("No parked items.")).not.toBeInTheDocument();
  });

  it("shows each section's own empty state when there are no parked rows", async () => {
    mockState.results = {
      inbox_items: [{ data: [], count: 0, error: null }],
      project_search: [{ data: [], count: 0, error: null }],
      goals: [{ data: [], count: 0, error: null }],
    };

    await renderPage();

    expect(screen.getByRole("heading", { name: "Parked items (0)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Someday projects (0)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Someday goals (0)" })).toBeInTheDocument();
    expect(screen.getByText("No parked items.")).toBeInTheDocument();
    expect(screen.getByText("No Someday projects.")).toBeInTheDocument();
    expect(screen.getByText("No Someday goals.")).toBeInTheDocument();
  });

  it.each([
    ["inbox_items", "Parked items"],
    ["project_search", "Someday projects"],
    ["goals", "Someday goals"],
  ])("shows a page-level retry state when %s read fails", async (table) => {
    mockState.results[table] = [{ data: null, count: null, error: { message: "read failed" } }];

    await renderPage();

    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).querySelector('[aria-current="page"]')).toHaveTextContent("Someday");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Parked items \(/ })).not.toBeInTheDocument();
    expect(screen.queryByText("No parked items.")).not.toBeInTheDocument();
  });

  it("retries the server page after a read failure", async () => {
    mockState.results.goals = [
      { data: null, count: null, error: { message: "read failed" } },
    ];
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(mockState.refresh).toHaveBeenCalledOnce();
  });

  it.each(["inbox_items", "project_search", "goals"])(
    "treats a missing row array with a positive count from %s as a read failure",
    async (table) => {
      mockState.results[table] = [{ data: null, count: 1, error: null }];

      await renderPage();

      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      expect(screen.queryByText("No parked items.")).not.toBeInTheDocument();
    },
  );

  it.each(["inbox_items", "project_search", "goals"])(
    "treats a missing exact count from %s as a read failure",
    async (table) => {
      mockState.results[table] = [{ data: [], count: null, error: null }];

      await renderPage();

      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      expect(screen.queryByText("No parked items.")).not.toBeInTheDocument();
    },
  );
});