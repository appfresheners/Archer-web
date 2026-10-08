import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClarifyPage from "./page";

const mockState = vi.hoisted(() => ({
  calls: [] as { table: string; method: string; args: unknown[] }[],
  item: {
    data: null as { id: string; raw_text: string; processing_status: string } | null,
    error: null as { message: string } | null,
  },
  projects: {
    data: null as {
      id: string;
      name: string;
      status: string;
      goal_id: string | null;
      parent_goal_text: string | null;
    }[] | null,
    error: null as { message: string } | null,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: (columns: string) => {
        mockState.calls.push({ table, method: "select", args: [columns] });
        if (table === "inbox_items") {
          return {
            eq: (column: string, value: string) => {
              mockState.calls.push({ table, method: "eq", args: [column, value] });
              return { maybeSingle: async () => mockState.item };
            },
          };
        }
        return {
          order: async (column: string, options: unknown) => {
            mockState.calls.push({ table, method: "order", args: [column, options] });
            return mockState.projects;
          },
        };
      },
    }),
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/components/inbox/clarify/ClarifyWizard", () => ({
  default: ({ projects }: { projects: { id: string; name: string; parent_goal_text: string | null }[] }) => (
    <ul data-testid="clarify-projects">
      {projects.map((project) => (
        <li key={project.id}>{`${project.name}|${project.parent_goal_text ?? "No goal"}`}</li>
      ))}
    </ul>
  ),
}));

describe("ClarifyPage project options", () => {
  beforeEach(() => {
    mockState.calls = [];
    mockState.item = {
      data: { id: "inbox-1", raw_text: "Book a dentist appointment", processing_status: "unprocessed" },
      error: null,
    };
    mockState.projects = {
      data: [
        {
          id: "p1",
          name: "Dental care",
          status: "paused",
          goal_id: "g1",
          parent_goal_text: "Improve my health",
        },
        {
          id: "p2",
          name: "Home repair",
          status: "active",
          goal_id: null,
          parent_goal_text: null,
        },
        {
          id: "p3",
          name: "Old plan",
          status: "archived",
          goal_id: null,
          parent_goal_text: null,
        },
        {
          id: "p4",
          name: "Finished plan",
          status: "completed",
          goal_id: null,
          parent_goal_text: null,
        },
      ],
      error: null,
    };
  });

  it("loads parent-goal and status fields from the RLS-scoped project_search view and excludes ineligible status", async () => {
    const ui = await ClarifyPage({ params: Promise.resolve({ id: "inbox-1" }) });
    render(ui);

    expect(screen.getByTestId("clarify-projects")).toHaveTextContent("Dental care|Improve my health");
    expect(screen.getByTestId("clarify-projects")).toHaveTextContent("Home repair|No goal");
    expect(screen.queryByText(/Old plan|Finished plan/)).not.toBeInTheDocument();
    expect(mockState.calls).toContainEqual({
      table: "project_search",
      method: "select",
      args: ["id, name, status, goal_id, parent_goal_text"],
    });
    expect(mockState.calls).toContainEqual({
      table: "project_search",
      method: "order",
      args: ["name", { ascending: true }],
    });
  });
});