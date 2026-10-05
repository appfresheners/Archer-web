import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadGoalsForPicker } from "./load-goals";
import { loadAreasForPicker } from "./load-goals";

let selectResult: { data: unknown; error: unknown };
const selectSpy = vi.fn();
const inSpy = vi.fn();
const orderSpy = vi.fn();
const areaSelectSpy = vi.fn();
const isSpy = vi.fn();
const areaOrderSpy = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "areas_of_focus") {
        return {
          select: (columns: string) => {
            areaSelectSpy(columns);
            return {
              is: (column: string, value: unknown) => {
                isSpy(column, value);
                return {
                  order: (orderColumn: string, opts: unknown) => {
                    areaOrderSpy(orderColumn, opts);
                    return selectResult;
                  },
                };
              },
            };
          },
        };
      }
      if (table !== "goals") throw new Error(`unexpected table: ${table}`);
      return {
        select: (columns: string) => {
          // Capture the selected columns so the test can pin the query shape.
          selectSpy(columns);
          return {
            in: (column: string, values: unknown) => {
              inSpy(column, values);
              return {
                order: (orderColumn: string, opts: unknown) => {
                  orderSpy(orderColumn, opts);
                  return selectResult;
                },
              };
            },
          };
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

  it("restricts to non-terminal goal statuses, ordered by goal_text", async () => {
    selectResult = { data: [], error: null };
    await loadGoalsForPicker();

    expect(inSpy).toHaveBeenCalledWith("status", [
      "active",
      "paused",
      "not_now",
      "someday",
    ]);
    expect(orderSpy).toHaveBeenCalledWith("goal_text", { ascending: true });
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

describe("loadAreasForPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = { data: [], error: null };
  });

  it("maps active Area rows into selector options", async () => {
    selectResult = {
      data: [
        { id: "a1", name: "Health" },
        { id: "a2", name: "Family" },
      ],
      error: null,
    };
    await expect(loadAreasForPicker()).resolves.toEqual([
      { id: "a1", name: "Health" },
      { id: "a2", name: "Family" },
    ]);
    expect(areaSelectSpy).toHaveBeenCalledWith("id, name");
    expect(isSpy).toHaveBeenCalledWith("archived_at", null);
    expect(areaOrderSpy).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("degrades to an empty option list on errors", async () => {
    selectResult = { data: null, error: { message: "boom" } };
    await expect(loadAreasForPicker()).resolves.toEqual([]);
  });
});
