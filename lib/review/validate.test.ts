import { describe, expect, it } from "vitest";
import { sanitizeReviewPatch } from "./validate";

describe("sanitizeReviewPatch", () => {
  it("accepts a valid current_phase beat", () => {
    expect(sanitizeReviewPatch({ current_phase: "get_current" })).toEqual({
      current_phase: "get_current",
    });
    expect(sanitizeReviewPatch({ current_phase: "snapshot_open" })).toEqual({
      current_phase: "snapshot_open",
    });
    expect(sanitizeReviewPatch({ current_phase: "snapshot_close" })).toEqual({
      current_phase: "snapshot_close",
    });
  });

  it("rejects the terminal 'complete' phase (not navigable via this PATCH)", () => {
    expect(sanitizeReviewPatch({ current_phase: "complete" })).toBeNull();
  });

  it("rejects an unknown phase value", () => {
    expect(sanitizeReviewPatch({ current_phase: "nope" })).toBeNull();
    expect(sanitizeReviewPatch({ current_phase: 3 })).toBeNull();
    expect(sanitizeReviewPatch({ current_phase: null })).toBeNull();
  });

  it("returns null when there is no valid patchable field", () => {
    expect(sanitizeReviewPatch({})).toBeNull();
    expect(sanitizeReviewPatch({ other: "x" })).toBeNull();
  });

  it("returns null for non-object bodies", () => {
    expect(sanitizeReviewPatch(null)).toBeNull();
    expect(sanitizeReviewPatch(undefined)).toBeNull();
    expect(sanitizeReviewPatch("get_clear")).toBeNull();
    expect(sanitizeReviewPatch(["get_clear"])).toBeNull();
    expect(sanitizeReviewPatch(42)).toBeNull();
  });
});
