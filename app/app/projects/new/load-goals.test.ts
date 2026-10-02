import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadGoalsForPicker } from "./load-goals";

let selectResult: { data: unknown; error: unknown };
const selectSpy = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table !== "goals") throw new Error(`unexpected table: ${table}`);
      return {
        select: (columns: string) => {
          // Capture the selected columns so the test can pin the query shape.
          selectSpy(columns);
          return selectResult;
        },
      };
    },
  }),
}));

describe("loadGoalsForPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = { data: [], error: null };
  });

  it("maps { id, goal_text } rows into GoalOption[]", async () => {
    selectResult = {
      data: [
        { id: "g1", goal_text: "First goal" },
        { id: "g2", goal_text: "Second goal" },
      ],
      error: null,
    };
    await expect(loadGoalsForPicker()).resolves.toEqual([
      { id: "g1", goal_text: "First goal" },
      { id: "g2", goal_text: "Second goal" },
    ]);
    expect(selectSpy).toHaveBeenCalledWith("id, goal_text");
  });

  it("degrades to [] when the query errors", async () => {
    selectResult = { data: null, error: { message: "boom" } };
    await expect(loadGoalsForPicker()).resolves.toEqual([]);
  });

  it("degrades to [] when the client throws", async () => {
    selectSpy.mockImplementationOnce(() => {
      throw new Error("no client");
    });
    await expect(loadGoalsForPicker()).resolves.toEqual([]);
  });
});
