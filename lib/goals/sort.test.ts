import { describe, expect, it } from "vitest";
import { sortGoals } from "./sort";

describe("sortGoals", () => {
  it("orders by status precedence Active→Paused→Not now→Someday→Completed→Archived", () => {
    const goals = [
      { id: "archived", status: "archived" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "completed", status: "completed" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "someday", status: "someday" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "not_now", status: "not_now" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "paused", status: "paused" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "active", status: "active" as const, created_at: "2026-01-01T00:00:00Z" },
    ];
    expect(sortGoals(goals).map((g) => g.id)).toEqual([
      "active",
      "paused",
      "not_now",
      "someday",
      "completed",
      "archived",
    ]);
  });

  it("orders newest-first within the same status", () => {
    const goals = [
      { id: "old", status: "active" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "new", status: "active" as const, created_at: "2026-06-01T00:00:00Z" },
      { id: "mid", status: "active" as const, created_at: "2026-03-01T00:00:00Z" },
    ];
    expect(sortGoals(goals).map((g) => g.id)).toEqual(["new", "mid", "old"]);
  });

  it("does not mutate the input array", () => {
    const goals = [
      { id: "a", status: "completed" as const, created_at: "2026-01-01T00:00:00Z" },
      { id: "b", status: "active" as const, created_at: "2026-01-01T00:00:00Z" },
    ];
    const original = [...goals];
    sortGoals(goals);
    expect(goals).toEqual(original);
  });
});
