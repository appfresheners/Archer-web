import { describe, expect, it } from "vitest";
import { sanitizeReviewPatch, SNAPSHOT_FIELD_MAX_LENGTH } from "./validate";

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

  // --- Story 5.5: snapshot text fields -------------------------------------

  it("accepts each snapshot text field on its own", () => {
    expect(sanitizeReviewPatch({ opening_retrospective: "shipped x" })).toEqual({
      opening_retrospective: "shipped x",
    });
    expect(sanitizeReviewPatch({ closing_intention: "focus on y" })).toEqual({
      closing_intention: "focus on y",
    });
    expect(sanitizeReviewPatch({ closing_blocker: "z might derail" })).toEqual({
      closing_blocker: "z might derail",
    });
  });

  it("accepts the snapshot fields alongside a phase", () => {
    expect(
      sanitizeReviewPatch({
        current_phase: "snapshot_open",
        opening_retrospective: "moved a, missed b",
      }),
    ).toEqual({
      current_phase: "snapshot_open",
      opening_retrospective: "moved a, missed b",
    });
  });

  it("accepts an EMPTY snapshot field (in-progress save; gates enforce non-empty)", () => {
    expect(sanitizeReviewPatch({ opening_retrospective: "" })).toEqual({
      opening_retrospective: "",
    });
    expect(sanitizeReviewPatch({ closing_intention: "" })).toEqual({
      closing_intention: "",
    });
  });

  it("accepts a snapshot field at the max length boundary", () => {
    const max = "a".repeat(SNAPSHOT_FIELD_MAX_LENGTH);
    expect(sanitizeReviewPatch({ closing_blocker: max })).toEqual({
      closing_blocker: max,
    });
  });

  it("rejects a snapshot field over the max length", () => {
    const tooLong = "a".repeat(SNAPSHOT_FIELD_MAX_LENGTH + 1);
    expect(sanitizeReviewPatch({ opening_retrospective: tooLong })).toBeNull();
  });

  it("rejects a non-string snapshot field", () => {
    expect(sanitizeReviewPatch({ opening_retrospective: 5 })).toBeNull();
    expect(sanitizeReviewPatch({ closing_intention: null })).toBeNull();
    expect(sanitizeReviewPatch({ closing_blocker: ["x"] })).toBeNull();
  });
});
