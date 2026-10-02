import { describe, expect, it } from "vitest";
import {
  isProjectStatus,
  MAX_PROJECT_TEXT,
  sanitizeProjectPatch,
} from "./validate";

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
  it("keeps valid editable fields and drops truly unknown ones", () => {
    const patch = sanitizeProjectPatch({
      name: "  Base training  ",
      purpose: "Build a mileage base",
      successful_outcome: "Run 20 miles comfortably",
      status: "paused",
      extraneous: "should-be-ignored",
    });
    expect(patch).toEqual({
      name: "Base training",
      purpose: "Build a mileage base",
      successful_outcome: "Run 20 miles comfortably",
      status: "paused",
    });
    expect(patch && "extraneous" in patch).toBe(false);
  });

  it("links a project to a goal (goal_id uuid)", () => {
    const gid = "55555555-5555-4555-8555-555555555555";
    expect(sanitizeProjectPatch({ goal_id: gid })).toEqual({ goal_id: gid });
  });

  it("clears a project's goal (goal_id null)", () => {
    expect(sanitizeProjectPatch({ goal_id: null })).toEqual({ goal_id: null });
  });

  it("rejects an invalid (non-uuid) goal_id", () => {
    expect(sanitizeProjectPatch({ goal_id: "not-a-uuid" })).toBeNull();
    expect(sanitizeProjectPatch({ goal_id: 5 })).toBeNull();
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

  it("rejects over-long purpose or successful outcome", () => {
    expect(
      sanitizeProjectPatch({ purpose: "x".repeat(MAX_PROJECT_TEXT + 1) }),
    ).toBeNull();
    expect(
      sanitizeProjectPatch({
        successful_outcome: "x".repeat(MAX_PROJECT_TEXT + 1),
      }),
    ).toBeNull();
  });

  it("rejects an invalid status", () => {
    expect(sanitizeProjectPatch({ status: "someday" })).toBeNull();
  });

  it("returns null for empty or non-object patches", () => {
    expect(sanitizeProjectPatch({})).toBeNull();
    expect(sanitizeProjectPatch(null)).toBeNull();
  });
});
