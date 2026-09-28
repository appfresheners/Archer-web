import { describe, expect, it } from "vitest";
import { countStuckProjects, isProjectStuck } from "./stuck";

describe("isProjectStuck", () => {
  it("is stuck when active with zero committed actions", () => {
    expect(
      isProjectStuck({ status: "active" }, [
        { status: "available" },
        { status: "done" },
      ]),
    ).toBe(true);
  });

  it("is stuck when active with no actions at all", () => {
    expect(isProjectStuck({ status: "active" }, [])).toBe(true);
  });

  it("is NOT stuck when active with a committed action", () => {
    expect(
      isProjectStuck({ status: "active" }, [
        { status: "available" },
        { status: "committed" },
      ]),
    ).toBe(false);
  });

  it("is NOT stuck when not active, even with zero committed", () => {
    for (const status of ["paused", "completed", "archived"] as const) {
      expect(isProjectStuck({ status }, [{ status: "available" }])).toBe(false);
    }
  });
});

describe("countStuckProjects", () => {
  it("counts only the active-with-no-committed projects", () => {
    const count = countStuckProjects([
      { status: "active", actions: [] }, // stuck
      { status: "active", actions: [{ status: "committed" }] }, // ok
      { status: "active", actions: [{ status: "available" }] }, // stuck
      { status: "paused", actions: [] }, // not stuck (paused)
      { status: "completed", actions: [{ status: "done" }] }, // not stuck
    ]);
    expect(count).toBe(2);
  });

  it("returns 0 for an empty list", () => {
    expect(countStuckProjects([])).toBe(0);
  });
});
