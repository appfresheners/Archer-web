import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "./page";

// --- Mocks -----------------------------------------------------------------

const projectsOrder = vi.fn();
const goalsOrder = vi.fn();

// createClient().from("projects").select(...).order(...)
// createClient().from("goals").select(...).order(...)
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: () => ({
        order: () =>
          table === "projects" ? projectsOrder() : goalsOrder(),
      }),
    }),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

async function renderPage(searchParams: { goal?: string } = {}) {
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
  { id: "p1", name: "Base training", status: "active", goal_id: "goal-1" },
  { id: "p2", name: "Write issue #1", status: "active", goal_id: "goal-2" },
  { id: "p3", name: "Standalone", status: "paused", goal_id: null },
];

describe("ProjectsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectsOrder.mockResolvedValue({ data: PROJECTS, error: null });
    goalsOrder.mockResolvedValue({ data: GOALS, error: null });
  });

  it("renders an error state when a read errors", async () => {
    projectsOrder.mockResolvedValue({ data: null, error: { message: "boom" } });
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
  });

  it("filters to goal-less projects via ?goal=none", async () => {
    await renderPage({ goal: "none" });

    expect(screen.getByText("Standalone")).toBeInTheDocument();
    expect(screen.queryByText("Base training")).not.toBeInTheDocument();
    expect(screen.queryByText("Write issue #1")).not.toBeInTheDocument();
    expect(
      (screen.getByRole("combobox", { name: "Filter by goal" }) as HTMLSelectElement)
        .value,
    ).toBe("none");
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

  it("renders All goals, each goal, and No goal as dropdown options", async () => {
    await renderPage();

    expect(screen.getByRole("option", { name: "All goals" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Run a marathon" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Launch a newsletter" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No goal" })).toBeInTheDocument();
  });

  it("hides the dropdown when there are no goals", async () => {
    goalsOrder.mockResolvedValue({ data: [], error: null });
    await renderPage();

    expect(
      screen.queryByRole("combobox", { name: "Filter by goal" }),
    ).not.toBeInTheDocument();
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
    projectsOrder.mockResolvedValue({ data: [], error: null });
    await renderPage();

    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
  });

  it("shows a no-match message when the filter excludes every project", async () => {
    projectsOrder.mockResolvedValue({
      data: PROJECTS.filter((p) => p.goal_id !== "goal-3"),
      error: null,
    });
    goalsOrder.mockResolvedValue({
      data: [
        { id: "goal-3", goal_text: "Empty goal" },
      ],
      error: null,
    });

    await renderPage({ goal: "goal-3" });

    expect(screen.getByText("No projects match this filter.")).toBeInTheDocument();
  });
});
