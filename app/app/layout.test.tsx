import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "./layout";

const getUser = vi.fn();
const dueGoalsQuery = vi.fn();
const selectedColumns = vi.fn();
const equalityFilters = vi.fn();
const dueFilter = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: (columns: string) => {
        selectedColumns(columns);
        return {
          eq: (column: string, value: string) => {
            equalityFilters(column, value);
            return {
              eq: (nextColumn: string, nextValue: string) => {
                equalityFilters(nextColumn, nextValue);
                return {
                  or: (filter: string) => {
                    dueFilter(filter);
                    return dueGoalsQuery();
                  },
                };
              },
            };
          },
        };
      },
    }),
  }),
}));

vi.mock("next/navigation", () => ({ redirect: (path: string) => redirect(path) }));
vi.mock("@/components/authenticated/BottomNav", () => ({ default: () => null }));
vi.mock("@/components/authenticated/FloatingCapture", () => ({ default: () => null }));
vi.mock("@/components/authenticated/Sidebar", () => ({ default: () => <nav>Sidebar</nav> }));

describe("AppLayout monthly goal prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    dueGoalsQuery.mockResolvedValue({ data: [], error: null });
    selectedColumns.mockClear();
    equalityFilters.mockClear();
    dueFilter.mockClear();
  });

  it("shows due goals above the authenticated route content", async () => {
    dueGoalsQuery.mockResolvedValue({
      data: [{ id: "g1", goal_text: "Run a marathon" }],
      error: null,
    });
    const ui = await AppLayout({ children: <div>Goal list</div> });
    render(ui);

    expect(screen.getByRole("link", { name: "Run a marathon" })).toHaveAttribute(
      "href",
      "/app/review/monthly/g1",
    );
    expect(screen.getByText("Goal list")).toBeInTheDocument();
    expect(selectedColumns).toHaveBeenCalledWith("id, goal_text");
    expect(equalityFilters).toHaveBeenNthCalledWith(1, "user_id", "u1");
    expect(equalityFilters).toHaveBeenNthCalledWith(2, "status", "active");
    expect(dueFilter).toHaveBeenCalledWith(
      expect.stringMatching(
        /^last_checked_at\.lte\..+,and\(last_checked_at\.is\.null,created_at\.lte\..+\)$/,
      ),
    );
  });

  it("shows no prompt when the due-goal query is empty", async () => {
    const ui = await AppLayout({ children: <div>Goal list</div> });
    render(ui);

    expect(screen.queryByLabelText("Monthly goal checks due")).not.toBeInTheDocument();
    expect(screen.getByText("Goal list")).toBeInTheDocument();
  });

  it("keeps the shell usable when the due-goal query fails", async () => {
    dueGoalsQuery.mockRejectedValue(new Error("database unavailable"));
    const ui = await AppLayout({ children: <div>Goal list</div> });
    render(ui);

    expect(screen.getByText("Goal list")).toBeInTheDocument();
    expect(screen.queryByLabelText("Monthly goal checks due")).not.toBeInTheDocument();
  });

  it("preserves the auth redirect when no user is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(AppLayout({ children: <div>Private content</div> })).rejects.toThrow(
      "REDIRECT:/sign-in",
    );
    expect(dueGoalsQuery).not.toHaveBeenCalled();
  });
});