import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoalDetailPage from "./page";

// --- Mocks -----------------------------------------------------------------

const goalMaybeSingle = vi.fn();
const projectsOrder = vi.fn();
const actionsIn = vi.fn();
const attachableProjects = vi.fn();
const projectSearchSelect = vi.fn();
const areaOptions = vi.fn();
const assignedArea = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "goals") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => goalMaybeSingle() }) }),
        };
      }
      if (table === "project_search") {
        return {
          select: (columns: string) => {
            projectSearchSelect(columns);
            return {
              then: (resolve: (v: unknown) => void) => resolve(attachableProjects()),
            };
          },
        };
      }
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({ order: () => projectsOrder() }),
          }),
        };
      }
      if (table === "areas_of_focus") {
        return {
          select: (columns: string) =>
            columns === "id, name"
              ? { is: () => ({ order: () => areaOptions() }) }
              : { eq: () => ({ maybeSingle: () => assignedArea() }) },
        };
      }
      return { select: () => ({ in: () => actionsIn() }) };
    },
  }),
}));

class NotFoundError extends Error { }
const notFound = vi.fn(() => {
  throw new NotFoundError("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// The interactive client header is exercised in its own concerns; stub it so
// the server-page test focuses on the read/render surface.
vi.mock("./GoalDetailClient", () => ({
  default: ({
    goal,
    areas = [],
    assignedArea: area = null,
  }: {
    goal: { goal_text: string };
    areas?: { id: string; name: string }[];
    assignedArea?: { id: string; name: string; archived: boolean } | null;
  }) => (
    <div
      data-testid="goal-client"
      data-area-count={areas.length}
      data-assigned-area={area?.name ?? ""}
      data-area-archived={area?.archived ? "true" : "false"}
    >
      {goal.goal_text}
    </div>
  ),
}));

// The attach-existing-project control is covered by its own test file; stub it
// so the page test can render without a router, but surface its props so the
// page-level wiring is still asserted.
vi.mock("./AttachProjectControl", () => ({
  default: ({
    goalId,
    projects,
  }: {
    goalId: string;
    projects: unknown[];
  }) => (
    <div
      data-testid="attach-project-control"
      data-goal-id={goalId}
      data-project-count={projects.length}
    />
  ),
}));

async function renderPage(id: string) {
  const ui = await GoalDetailPage({ params: Promise.resolve({ id }) });
  return render(ui);
}

describe("GoalDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectsOrder.mockResolvedValue({ data: [], error: null });
    actionsIn.mockResolvedValue({ data: [], error: null });
    attachableProjects.mockResolvedValue({ data: [], error: null });
    projectSearchSelect.mockClear();
    areaOptions.mockResolvedValue({ data: [], error: null });
    assignedArea.mockResolvedValue({ data: null, error: null });
  });

  it("renders the gap analysis, projects, and Monthly Check when the goal exists", async () => {
    goalMaybeSingle.mockResolvedValue({
      data: {
        id: "g1",
        area_id: null,
        goal_text: "Run a marathon",
        why: "I want to build confidence and endurance.",
        status: "active",
        target_date: "2026-12-31",
        last_checked_at: null,
        skill_framework: [
          { name: "Pacing", required_level: 9, user_rating: 5, description: "" },
        ],
        drivers: ["health"],
        barriers: ["time"],
        if_then_plans: ["If tired, then rest.", "If sore, then stretch."],
        goal_statement: "In 3 months I will have finished the marathon.",
        success_criteria: ["Ran 26.2 miles", "Finished under 5 hours"],
      },
      error: null,
    });
    projectsOrder.mockResolvedValue({
      data: [{ id: "p1", name: "Base training", status: "active", sort_order: 0 }],
      error: null,
    });
    actionsIn.mockResolvedValue({
      data: [{ project_id: "p1", status: "available" }],
      error: null,
    });

    await renderPage("g1");

    expect(screen.getByTestId("goal-client")).toHaveTextContent("Run a marathon");
    expect(screen.getByText("I want to build confidence and endurance.")).toBeInTheDocument();
    // Unnumbered My Goal section: AI-refined statement + criteria.
    expect(screen.getByRole("heading", { name: "My Goal" })).toBeInTheDocument();
    expect(
      screen.getByText("In 3 months I will have finished the marathon."),
    ).toBeInTheDocument();
    expect(screen.getByText("Success criteria")).toBeInTheDocument();
    expect(screen.getByText("Ran 26.2 miles")).toBeInTheDocument();
    expect(screen.getByText("Finished under 5 hours")).toBeInTheDocument();
    // Gap analysis renders the if–then plans as a list.
    expect(screen.getByText("If tired, then rest.")).toBeInTheDocument();
    expect(screen.getByText("If sore, then stretch.")).toBeInTheDocument();
    expect(screen.getByText("Gap analysis")).toBeInTheDocument();
    expect(screen.getByText("Pacing")).toBeInTheDocument();
    // required 9, rating 5, gap = 4 (unique among the row's cells)
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Base training")).toBeInTheDocument();
    // p1 is active with no committed action → stuck band shows.
    expect(
      screen.getByText("No committed next action — this project is stuck."),
    ).toBeInTheDocument();
    expect(screen.getByText("Monthly Goal Check")).toBeInTheDocument();
    expect(screen.getByText("Last checked: Never")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start monthly goal check" })).toHaveAttribute(
      "href",
      "/app/review/monthly/g1",
    );
  });

  it("falls back to goal_text and hides criteria for a legacy goal", async () => {
    goalMaybeSingle.mockResolvedValue({
      data: {
        id: "g1",
        area_id: null,
        goal_text: "Run a marathon",
        why: "I want to build confidence and endurance.",
        status: "active",
        target_date: "2026-12-31",
        last_checked_at: null,
        skill_framework: null,
        drivers: null,
        barriers: null,
        if_then_plans: null,
        goal_statement: null,
        success_criteria: null,
      },
      error: null,
    });

    await renderPage("g1");

    expect(screen.getByRole("heading", { name: "My Goal" })).toBeInTheDocument();
    // The "My Goal" section falls back to the original goal_text.
    expect(
      screen.getByRole("heading", { name: "My Goal" }).closest("section"),
    ).toHaveTextContent("Run a marathon");
    // No empty success-criteria section for a legacy goal.
    expect(screen.queryByText("Success criteria")).not.toBeInTheDocument();
  });

  it("passes an active assigned Area and active options to Goal detail", async () => {
    goalMaybeSingle.mockResolvedValue({
      data: {
        id: "g1",
        area_id: "area-active",
        goal_text: "Run a marathon",
        why: null,
        status: "active",
        target_date: "2026-12-31",
        last_checked_at: null,
        skill_framework: null,
        drivers: null,
        barriers: null,
        if_then_plans: null,
        goal_statement: null,
        success_criteria: null,
      },
      error: null,
    });
    assignedArea.mockResolvedValue({
      data: { id: "area-active", name: "Health", archived_at: null },
      error: null,
    });
    areaOptions.mockResolvedValue({
      data: [{ id: "area-active", name: "Health" }],
      error: null,
    });

    await renderPage("g1");

    expect(screen.getByTestId("goal-client")).toHaveAttribute("data-assigned-area", "Health");
    expect(screen.getByTestId("goal-client")).toHaveAttribute("data-area-count", "1");
    expect(screen.getByTestId("goal-client")).toHaveAttribute("data-area-archived", "false");
  });

  it("passes an archived assigned Area but excludes it from selector options", async () => {
    goalMaybeSingle.mockResolvedValue({
      data: {
        id: "g1",
        area_id: "area-archived",
        goal_text: "Run a marathon",
        why: null,
        status: "active",
        target_date: "2026-12-31",
        last_checked_at: null,
        skill_framework: null,
        drivers: null,
        barriers: null,
        if_then_plans: null,
        goal_statement: null,
        success_criteria: null,
      },
      error: null,
    });
    assignedArea.mockResolvedValue({
      data: { id: "area-archived", name: "Work", archived_at: "2026-10-01T00:00:00Z" },
      error: null,
    });
    areaOptions.mockResolvedValue({ data: [], error: null });

    await renderPage("g1");

    expect(screen.getByTestId("goal-client")).toHaveAttribute("data-assigned-area", "Work");
    expect(screen.getByTestId("goal-client")).toHaveAttribute("data-area-count", "0");
    expect(screen.getByTestId("goal-client")).toHaveAttribute("data-area-archived", "true");
  });

  it("calls notFound() when the goal is absent", async () => {
    goalMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(renderPage("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("renders an error state when the goal query errors", async () => {
    goalMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await renderPage("g1");
    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("loads picker display and eligibility fields from project_search", async () => {
    goalMaybeSingle.mockResolvedValue({
      data: {
        id: "g1",
        area_id: null,
        goal_text: "Run a marathon",
        why: null,
        status: "active",
        target_date: "2026-12-31",
        last_checked_at: null,
        skill_framework: null,
        drivers: null,
        barriers: null,
        if_then_plans: null,
        goal_statement: null,
        success_criteria: null,
      },
      error: null,
    });
    attachableProjects.mockResolvedValue({
      data: [
        {
          id: "p9",
          name: "Other project",
          status: "paused",
          goal_id: null,
          parent_goal_text: null,
        },
        {
          id: "p10",
          name: "Linked elsewhere",
          status: "active",
          goal_id: "g2",
          parent_goal_text: "Another goal",
        },
        {
          id: "p11",
          name: "Archived project",
          status: "archived",
          goal_id: null,
          parent_goal_text: null,
        },
        {
          id: "p12",
          name: "Completed project",
          status: "completed",
          goal_id: null,
          parent_goal_text: null,
        },
      ],
      error: null,
    });

    await renderPage("g1");

    const control = screen.getByTestId("attach-project-control");
    expect(control).toHaveAttribute("data-goal-id", "g1");
    expect(control).toHaveAttribute("data-project-count", "2");
    expect(projectSearchSelect).toHaveBeenCalledWith(
      "id, name, status, goal_id, parent_goal_text",
    );
  });
});
