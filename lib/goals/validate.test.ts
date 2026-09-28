import { describe, expect, it } from "vitest";
import {
  isDateString,
  isGoalStatus,
  sanitizeFramework,
  sanitizeGoalPatch,
} from "./validate";

describe("isGoalStatus", () => {
  it("accepts the six valid statuses", () => {
    for (const s of [
      "active",
      "paused",
      "not_now",
      "someday",
      "completed",
      "archived",
    ]) {
      expect(isGoalStatus(s)).toBe(true);
    }
  });

  it("rejects unknown or non-string values", () => {
    expect(isGoalStatus("done")).toBe(false);
    expect(isGoalStatus("")).toBe(false);
    expect(isGoalStatus(3)).toBe(false);
    expect(isGoalStatus(null)).toBe(false);
  });
});

describe("isDateString", () => {
  it("accepts real YYYY-MM-DD dates", () => {
    expect(isDateString("2026-12-31")).toBe(true);
    expect(isDateString("2026-02-28")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    expect(isDateString("2026-13-01")).toBe(false);
    expect(isDateString("2026-02-30")).toBe(false);
    expect(isDateString("2026-1-1")).toBe(false);
    expect(isDateString("not-a-date")).toBe(false);
    expect(isDateString(20261231)).toBe(false);
  });
});

describe("sanitizeFramework", () => {
  it("returns typed items for a valid framework", () => {
    const out = sanitizeFramework([
      { name: "Pacing", required_level: 8, user_rating: 4, description: "x" },
    ]);
    expect(out).toEqual([
      { name: "Pacing", required_level: 8, user_rating: 4, description: "x" },
    ]);
  });

  it("rejects out-of-range levels or missing names", () => {
    expect(
      sanitizeFramework([{ name: "", required_level: 8, user_rating: 4 }]),
    ).toBeNull();
    expect(
      sanitizeFramework([{ name: "x", required_level: 0, user_rating: 4 }]),
    ).toBeNull();
    expect(
      sanitizeFramework([{ name: "x", required_level: 8, user_rating: 11 }]),
    ).toBeNull();
    expect(sanitizeFramework("nope")).toBeNull();
  });
});

describe("sanitizeGoalPatch", () => {
  it("keeps only valid editable fields", () => {
    const patch = sanitizeGoalPatch({
      goal_text: "  Run a marathon  ",
      target_date: "2026-12-31",
      status: "paused",
      drivers: ["health", "  ", "pride"],
      barriers: ["time"],
      if_then_plan: "If tired, then rest.",
      unknown_field: "ignored",
    });
    expect(patch).toEqual({
      goal_text: "Run a marathon",
      target_date: "2026-12-31",
      status: "paused",
      drivers: ["health", "pride"],
      barriers: ["time"],
      if_then_plan: "If tired, then rest.",
    });
    // Unknown fields never leak through.
    expect(patch && "unknown_field" in patch).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(sanitizeGoalPatch({ status: "done" })).toBeNull();
  });

  it("rejects an out-of-bounds goal_text", () => {
    expect(sanitizeGoalPatch({ goal_text: "" })).toBeNull();
    expect(sanitizeGoalPatch({ goal_text: "x".repeat(501) })).toBeNull();
  });

  it("rejects an invalid target_date", () => {
    expect(sanitizeGoalPatch({ target_date: "2026-99-99" })).toBeNull();
  });

  it("allows clearing if_then_plan to null", () => {
    expect(sanitizeGoalPatch({ if_then_plan: null })).toEqual({
      if_then_plan: null,
    });
  });

  it("returns null for an empty or non-object patch", () => {
    expect(sanitizeGoalPatch({})).toBeNull();
    expect(sanitizeGoalPatch(null)).toBeNull();
    expect(sanitizeGoalPatch("string")).toBeNull();
  });
});
