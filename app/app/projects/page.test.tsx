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

  it("shows all projects when no filter is supplied", async () => {
    await renderPage();

    expect(screen.getByText("Base training")).toBeInTheDocument();
    expect(screen.getByText("Write issue #1")).toBeInTheDocument();
    expect(screen.getByText("Standalone")).toBeInTheDocument();
  });

  it("filters to a specific goal and marks the active filter link", async () => {
    await renderPage({ goal: "goal-2" });

    expect(screen.getByText("Write issue #1")).toBeInTheDocument();
    expect(screen.queryByText("Base training")).not.toBeInTheDocument();
    expect(screen.queryByText("Standalone")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Launch a newsletter" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("filters to goal-less projects via ?goal=none", async () => {
    await renderPage({ goal: "none" });

    expect(screen.getByText("Standalone")).toBeInTheDocument();
    expect(screen.queryByText("Base training")).not.toBeInTheDocument();
    expect(screen.queryByText("Write issue #1")).not.toBeInTheDocument();
  });

  it("falls back to All for an unknown goal filter", async () => {
    await renderPage({ goal: "goal-does-not-exist" });

    expect(screen.getByText("Base training")).toBeInTheDocument();
    expect(screen.getByText("Write issue #1")).toBeInTheDocument();
    expect(screen.getByText("Standalone")).toBeInTheDocument();
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
