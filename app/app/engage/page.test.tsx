import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EngagePage from "./page";

// --- Mocks -----------------------------------------------------------------
// The page issues three parallel reads, each `.from(table).select(...)` awaited:
//   goals.select("id, goal_text, status")
//   projects.select("id, goal_id, name, status")
//   actions.select("id, project_id, text, status, context_tags, time_available_minutes, scheduled_for, sort_order")
// EngageBoard is a client component that uses next/navigation; mock it so the
// server-page render doesn't require a router.

const goalsSelect = vi.fn();
const projectsSelect = vi.fn();
const actionsSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "goals") return { select: () => goalsSelect() };
      if (table === "projects") return { select: () => projectsSelect() };
      return { select: () => actionsSelect() };
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

async function renderPage() {
  const ui = await EngagePage();
  return render(ui);
}

describe("EngagePage (loader)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    goalsSelect.mockResolvedValue({ data: [], error: null });
    projectsSelect.mockResolvedValue({ data: [], error: null });
    actionsSelect.mockResolvedValue({ data: [], error: null });
  });

  it("renders the honest empty state when there is nothing committed", async () => {
    await renderPage();
    expect(
      screen.getByText("No committed actions. Open a project and commit one."),
    ).toBeInTheDocument();
  });

  it("degrades to the empty state when a read errors (does not throw)", async () => {
    // A rejected read must be caught → safe empty model, not a crashed route.
    actionsSelect.mockRejectedValue(new Error("boom"));
    await renderPage();
    expect(
      screen.getByText("No committed actions. Open a project and commit one."),
    ).toBeInTheDocument();
  });

  it("flows loaded rows through buildEngageModel into grouped board output", async () => {
    goalsSelect.mockResolvedValue({
      data: [{ id: "g1", goal_text: "Run a marathon", status: "active" }],
      error: null,
    });
    projectsSelect.mockResolvedValue({
      data: [{ id: "p1", goal_id: "g1", name: "Base training", status: "active" }],
      error: null,
    });
    actionsSelect.mockResolvedValue({
      data: [
        {
          id: "a1",
          project_id: "p1",
          text: "Book a running coach",
          status: "committed",
          context_tags: [],
          time_available_minutes: 25,
          scheduled_for: null,
          sort_order: 0,
        },
      ],
      error: null,
    });

    await renderPage();

    // The goal group heading and the committed row flow through.
    expect(screen.getByText("Run a marathon")).toBeInTheDocument();
    expect(screen.getByText("Book a running coach")).toBeInTheDocument();
  });
});
