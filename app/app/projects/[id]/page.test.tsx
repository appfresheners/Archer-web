import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetailPage from "./page";

// --- Mocks -----------------------------------------------------------------

const projectMaybeSingle = vi.fn();
const actionsOrder = vi.fn();

// createClient().from("projects").select(...).eq(...).maybeSingle()
// createClient().from("actions").select(...).eq(...).order(...)
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => projectMaybeSingle() }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ order: () => actionsOrder() }),
        }),
      };
    },
  }),
}));

class NotFoundError extends Error { }
const notFound = vi.fn(() => {
  throw new NotFoundError("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

// --- Helpers ---------------------------------------------------------------

async function renderPage(id: string) {
  const ui = await ProjectDetailPage({ params: Promise.resolve({ id }) });
  return render(ui);
}

const twelveActions = Array.from({ length: 12 }, (_, i) => ({
  id: `a${i}`,
  text: `Action ${i + 1}`,
  sort_order: i,
}));

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a Minimal project's structured fields + actions checklist", async () => {
    projectMaybeSingle.mockResolvedValue({
      data: {
        id: "project-1",
        name: "Portfolio site live",
        purpose: "Establishes an online presence.",
        successful_outcome: "Deployed at a public URL.",
        planning_depth: "minimal",
        planning_detail: null,
      },
      error: null,
    });
    actionsOrder.mockResolvedValue({ data: twelveActions, error: null });

    await renderPage("project-1");

    expect(
      screen.getByRole("heading", { level: 1, name: "Portfolio site live" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Establishes an online presence.")).toBeInTheDocument();
    expect(screen.getByText("Deployed at a public URL.")).toBeInTheDocument();
    expect(screen.getByText("Minimal")).toBeInTheDocument();
    // 12 action checkboxes rendered from structured rows.
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
    expect(screen.getByText("Action 1")).toBeInTheDocument();
    // No Full-GTD sections for a minimal project.
    expect(screen.queryByText("Principles")).not.toBeInTheDocument();
  });

  it("renders Full-GTD planning_detail sections", async () => {
    projectMaybeSingle.mockResolvedValue({
      data: {
        id: "project-2",
        name: "Consistent writing habit",
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
    actionsOrder.mockResolvedValue({ data: twelveActions, error: null });

    await renderPage("project-2");

    expect(screen.getByText("Full GTD")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Principles" })).toBeInTheDocument();
    expect(screen.getByText("Protect the morning block")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vision" })).toBeInTheDocument();
    expect(screen.getByText("A 30-day streak exists.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ideas & Brainstorming" }),
    ).toBeInTheDocument();
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
