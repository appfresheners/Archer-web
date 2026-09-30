import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetailPage from "./page";

// --- Mocks -----------------------------------------------------------------

const projectMaybeSingle = vi.fn();
const goalMaybeSingle = vi.fn();
const actionsOrder = vi.fn();

// createClient().from("projects").select(...).eq(...).maybeSingle()
// createClient().from("goals").select(...).eq(...).maybeSingle()   (breadcrumb)
// createClient().from("actions").select(...).eq(...).order(...)
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "projects") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => projectMaybeSingle() }) }) };
      }
      if (table === "goals") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => goalMaybeSingle() }) }) };
      }
      return { select: () => ({ eq: () => ({ order: () => actionsOrder() }) }) };
    },
  }),
}));

class NotFoundError extends Error { }
const notFound = vi.fn(() => {
  throw new NotFoundError("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

// The interactive client pieces are covered in their own concerns; stub them
// so the server-page test focuses on the read/render surface.
vi.mock("./ProjectDetailClient", () => ({
  default: ({ project }: { project: { name: string } }) => (
    <div data-testid="project-client">{project.name}</div>
  ),
}));
vi.mock("@/components/projects/ActionList", () => ({
  default: ({ actions }: { actions: { id: string }[] }) => (
    <div data-testid="action-list">{actions.length} actions</div>
  ),
}));

async function renderPage(id: string) {
  const ui = await ProjectDetailPage({ params: Promise.resolve({ id }) });
  return render(ui);
}

const twelveActions = Array.from({ length: 12 }, (_, i) => ({
  id: `a${i}`,
  text: `Action ${i + 1}`,
  // One committed action → the project is NOT stuck by default.
  status: i === 0 ? "committed" : "available",
  context_tags: [],
  time_available_minutes: 25,
  sort_order: i,
}));

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    goalMaybeSingle.mockResolvedValue({ data: null, error: null });
    actionsOrder.mockResolvedValue({ data: twelveActions, error: null });
  });

  it("renders a Minimal project's structured fields, status, breadcrumb + actions", async () => {
    projectMaybeSingle.mockResolvedValue({
      data: {
        id: "project-1",
        name: "Portfolio site live",
        goal_id: "goal-1",
        status: "active",
        purpose: "Establishes an online presence.",
        successful_outcome: "Deployed at a public URL.",
        planning_depth: "minimal",
        planning_detail: null,
      },
      error: null,
    });
    goalMaybeSingle.mockResolvedValue({
      data: { goal_text: "Launch my freelance career" },
      error: null,
    });

    await renderPage("project-1");

    expect(
      screen.getByRole("heading", { level: 1, name: "Portfolio site live" }),
    ).toBeInTheDocument();
    // Status badge + breadcrumb to the parent goal.
    expect(screen.getByText("Active")).toBeInTheDocument();
    const crumb = screen.getByRole("link", { name: /Launch my freelance career/ });
    expect(crumb).toHaveAttribute("href", "/app/goals/goal-1");
    expect(screen.getByText("Establishes an online presence.")).toBeInTheDocument();
    expect(screen.getByText("Deployed at a public URL.")).toBeInTheDocument();
    expect(screen.getByText("Minimal")).toBeInTheDocument();
    // Actions are handed to the (stubbed) interactive ActionList.
    expect(screen.getByTestId("action-list")).toHaveTextContent("12 actions");
    expect(screen.getByTestId("project-client")).toHaveTextContent(
      "Portfolio site live",
    );
    expect(screen.queryByText("Principles")).not.toBeInTheDocument();
  });

  it("renders a goal-less project with a fallback breadcrumb to the goals list", async () => {
    projectMaybeSingle.mockResolvedValue({
      data: {
        id: "project-3",
        name: "Standalone project",
        goal_id: null,
        status: "active",
        purpose: "Something",
        successful_outcome: null,
        planning_depth: "minimal",
        planning_detail: null,
      },
      error: null,
    });

    await renderPage("project-3");

    const crumb = screen.getByRole("link", { name: /Goals/ });
    expect(crumb).toHaveAttribute("href", "/app/goals");
    // The parent-goal lookup is never attempted for a goal-less project.
    expect(goalMaybeSingle).not.toHaveBeenCalled();
  });

  it("shows the stuck indicator for an Active project with zero committed actions", async () => {
    projectMaybeSingle.mockResolvedValue({
      data: {
        id: "project-stuck",
        name: "Stuck project",
        goal_id: null,
        status: "active",
        purpose: null,
        successful_outcome: null,
        planning_depth: "minimal",
        planning_detail: null,
      },
      error: null,
    });
    // Actions exist but none are committed → stuck.
    actionsOrder.mockResolvedValue({
      data: [
        { id: "a0", text: "A", status: "available", context_tags: [], time_available_minutes: 25, sort_order: 0 },
      ],
      error: null,
    });

    await renderPage("project-stuck");

    expect(
      screen.getByText("No committed next action — this project is stuck."),
    ).toBeInTheDocument();
  });

  it("hides the stuck indicator when a committed action exists", async () => {
    projectMaybeSingle.mockResolvedValue({
      data: {
        id: "project-ok",
        name: "Healthy project",
        goal_id: null,
        status: "active",
        purpose: null,
        successful_outcome: null,
        planning_depth: "minimal",
        planning_detail: null,
      },
      error: null,
    });
    // Default twelveActions has one committed action → not stuck.

    await renderPage("project-ok");

    expect(
      screen.queryByText("No committed next action — this project is stuck."),
    ).not.toBeInTheDocument();
  });

  it("hides the stuck indicator for a non-active project", async () => {
    projectMaybeSingle.mockResolvedValue({
      data: {
        id: "project-paused",
        name: "Paused project",
        goal_id: null,
        status: "paused",
        purpose: null,
        successful_outcome: null,
        planning_depth: "minimal",
        planning_detail: null,
      },
      error: null,
    });
    actionsOrder.mockResolvedValue({
      data: [
        { id: "a0", text: "A", status: "available", context_tags: [], time_available_minutes: 25, sort_order: 0 },
      ],
      error: null,
    });

    await renderPage("project-paused");

    expect(
      screen.queryByText("No committed next action — this project is stuck."),
    ).not.toBeInTheDocument();
  });

  it("falls back to the goals-list breadcrumb when the parent goal text is null", async () => {
    projectMaybeSingle.mockResolvedValue({
      data: {
        id: "project-4",
        name: "Orphaned-text project",
        goal_id: "goal-x",
        status: "active",
        purpose: "Something",
        successful_outcome: null,
        planning_depth: "minimal",
        planning_detail: null,
      },
      error: null,
    });
    // Goal row exists (or lookup returns) but with null text.
    goalMaybeSingle.mockResolvedValue({ data: { goal_text: null }, error: null });

    await renderPage("project-4");

    const crumb = screen.getByRole("link", { name: /Goals/ });
    expect(crumb).toHaveAttribute("href", "/app/goals");
  });

  it("renders Full-GTD planning_detail sections", async () => {
    projectMaybeSingle.mockResolvedValue({
      data: {
        id: "project-2",
        name: "Consistent writing habit",
        goal_id: null,
        status: "active",
        purpose: "Builds a durable skill.",
        successful_outcome: "30-day streak.",
        planning_depth: "full_gtd",
        planning_detail: {
          principles: ["Protect the morning block"],
          vision: "A 30-day streak exists.",
          ideas: ["Use a notebook"],
          organizing: ["Setup"],
        },
      },
      error: null,
    });

    await renderPage("project-2");

    expect(screen.getByText("Full GTD")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Principles" })).toBeInTheDocument();
    expect(screen.getByText("Protect the morning block")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vision" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ideas & Brainstorming" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Organizing" })).toBeInTheDocument();
  });

  it("calls notFound() when the project row is absent", async () => {
    projectMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(renderPage("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("calls notFound() when the query errors", async () => {
    projectMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(renderPage("project-1")).rejects.toBeInstanceOf(NotFoundError);
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
