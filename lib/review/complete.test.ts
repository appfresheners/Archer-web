import { describe, expect, it } from "vitest";
import { sanitizeReviewComplete } from "./complete";
import { SNAPSHOT_FIELD_MAX_LENGTH } from "./validate";

describe("sanitizeReviewComplete", () => {
  it("accepts non-empty intention + blocker, returning both", () => {
    expect(
      sanitizeReviewComplete({ intention: "ship v1", blocker: "scope creep" }),
    ).toEqual({ intention: "ship v1", blocker: "scope creep" });
  });

  it("trims surrounding whitespace from both fields", () => {
    expect(
      sanitizeReviewComplete({
        intention: "  focus  ",
        blocker: "\n distractions \t",
      }),
    ).toEqual({ intention: "focus", blocker: "distractions" });
  });

  it("rejects an empty or whitespace-only intention", () => {
    expect(
      sanitizeReviewComplete({ intention: "", blocker: "x" }),
    ).toBeNull();
    expect(
      sanitizeReviewComplete({ intention: "   ", blocker: "x" }),
    ).toBeNull();
  });

  it("rejects an empty or whitespace-only blocker", () => {
    expect(
      sanitizeReviewComplete({ intention: "x", blocker: "" }),
    ).toBeNull();
    expect(
      sanitizeReviewComplete({ intention: "x", blocker: "  \t " }),
    ).toBeNull();
  });

  it("rejects a missing field", () => {
    expect(sanitizeReviewComplete({ intention: "x" })).toBeNull();
    expect(sanitizeReviewComplete({ blocker: "x" })).toBeNull();
    expect(sanitizeReviewComplete({})).toBeNull();
  });

  it("rejects non-string fields", () => {
    expect(sanitizeReviewComplete({ intention: 1, blocker: "x" })).toBeNull();
    expect(sanitizeReviewComplete({ intention: "x", blocker: null })).toBeNull();
    expect(
      sanitizeReviewComplete({ intention: ["x"], blocker: "x" }),
    ).toBeNull();
  });

  it("rejects fields over the max length (after trim)", () => {
    const tooLong = "a".repeat(SNAPSHOT_FIELD_MAX_LENGTH + 1);
    expect(
      sanitizeReviewComplete({ intention: tooLong, blocker: "x" }),
    ).toBeNull();
    expect(
      sanitizeReviewComplete({ intention: "x", blocker: tooLong }),
    ).toBeNull();
  });

  it("accepts fields at the max length boundary", () => {
    const max = "a".repeat(SNAPSHOT_FIELD_MAX_LENGTH);
    expect(
      sanitizeReviewComplete({ intention: max, blocker: max }),
    ).toEqual({ intention: max, blocker: max });
  });

  it("rejects non-object bodies", () => {
    expect(sanitizeReviewComplete(null)).toBeNull();
    expect(sanitizeReviewComplete(undefined)).toBeNull();
    expect(sanitizeReviewComplete("x")).toBeNull();
    expect(sanitizeReviewComplete(["x"])).toBeNull();
    expect(sanitizeReviewComplete(42)).toBeNull();
  });
});
