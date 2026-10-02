import { describe, expect, it } from "vitest";
import {
  isActionStatus,
  sanitizeActionPatch,
  sanitizeActionText,
} from "./validate";

describe("isActionStatus", () => {
  it("accepts the three action statuses", () => {
    for (const s of ["available", "committed", "done"]) {
      expect(isActionStatus(s)).toBe(true);
    }
  });
  it("rejects unknown values", () => {
    expect(isActionStatus("archived")).toBe(false);
    expect(isActionStatus(null)).toBe(false);
  });
});

describe("sanitizeActionText", () => {
  it("trims and accepts 1..500 chars", () => {
    expect(sanitizeActionText("  Do the thing  ")).toBe("Do the thing");
  });
  it("rejects empty/whitespace/over-cap/non-string", () => {
    expect(sanitizeActionText("")).toBeNull();
    expect(sanitizeActionText("   ")).toBeNull();
    expect(sanitizeActionText("x".repeat(501))).toBeNull();
    expect(sanitizeActionText(5)).toBeNull();
  });
});

describe("sanitizeActionPatch", () => {
  it("accepts text + context_tags", () => {
    expect(
      sanitizeActionPatch({ text: " Call Sam ", context_tags: ["@energy:low"] }),
    ).toEqual({ text: "Call Sam", context_tags: ["@energy:low"] });
  });

  it("accepts bounded integer time availability", () => {
    expect(sanitizeActionPatch({ time_available_minutes: 15 })).toEqual({
      time_available_minutes: 15,
    });
    expect(sanitizeActionPatch({ time_available_minutes: 1 })).toEqual({
      time_available_minutes: 1,
    });
    expect(sanitizeActionPatch({ time_available_minutes: 120 })).toEqual({
      time_available_minutes: 120,
    });
  });

  it("rejects non-integer or out-of-range time availability", () => {
    for (const value of [0, 121, 2.5, "15", null]) {
      expect(sanitizeActionPatch({ time_available_minutes: value })).toBeNull();
    }
  });

  it("permits a completion toggle to available/done but never committed", () => {
    expect(sanitizeActionPatch({ status: "done" })).toEqual({ status: "done" });
    expect(sanitizeActionPatch({ status: "available" })).toEqual({
      status: "available",
    });
    expect(sanitizeActionPatch({ status: "committed" })).toBeNull();
  });

  it("rejects invalid text, invalid tags, and empty/non-object patches", () => {
    expect(sanitizeActionPatch({ text: "" })).toBeNull();
    expect(sanitizeActionPatch({ context_tags: ["@mood:x"] })).toBeNull();
    expect(sanitizeActionPatch({})).toBeNull();
    expect(sanitizeActionPatch(null)).toBeNull();
    expect(sanitizeActionPatch([])).toBeNull();
  });
});
