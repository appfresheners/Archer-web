import { describe, expect, it } from "vitest";
import { isProjectStatus, sanitizeProjectPatch } from "./validate";

describe("isProjectStatus", () => {
  it("accepts the four project statuses", () => {
    for (const s of ["active", "paused", "completed", "archived"]) {
      expect(isProjectStatus(s)).toBe(true);
    }
  });

  it("rejects goal-only or unknown statuses", () => {
    expect(isProjectStatus("someday")).toBe(false);
    expect(isProjectStatus("not_now")).toBe(false);
    expect(isProjectStatus("done")).toBe(false);
    expect(isProjectStatus(1)).toBe(false);
  });
});

describe("sanitizeProjectPatch", () => {
  it("keeps valid editable fields and drops unknown ones", () => {
    const patch = sanitizeProjectPatch({
      name: "  Base training  ",
      purpose: "Build a mileage base",
      successful_outcome: "Run 20 miles comfortably",
      status: "paused",
      goal_id: "should-be-ignored",
    });
    expect(patch).toEqual({
      name: "Base training",
      purpose: "Build a mileage base",
      successful_outcome: "Run 20 miles comfortably",
      status: "paused",
    });
    expect(patch && "goal_id" in patch).toBe(false);
  });

  it("allows clearing purpose/outcome to null", () => {
    expect(
      sanitizeProjectPatch({ purpose: null, successful_outcome: null }),
    ).toEqual({ purpose: null, successful_outcome: null });
  });

  it("rejects an out-of-bounds name", () => {
    expect(sanitizeProjectPatch({ name: "" })).toBeNull();
    expect(sanitizeProjectPatch({ name: "x".repeat(201) })).toBeNull();
  });

  it("rejects an invalid status", () => {
    expect(sanitizeProjectPatch({ status: "someday" })).toBeNull();
  });

  it("returns null for empty or non-object patches", () => {
    expect(sanitizeProjectPatch({})).toBeNull();
    expect(sanitizeProjectPatch(null)).toBeNull();
  });
});
