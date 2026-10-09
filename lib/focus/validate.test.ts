import { describe, expect, it } from "vitest";
import {
  sanitizeAreaInput,
  sanitizeFocusProfile,
} from "./validate";

describe("sanitizeFocusProfile", () => {
  it("normalizes optional fields and principles", () => {
    expect(
      sanitizeFocusProfile({
        vision: "  A clear future  ",
        purpose: " ",
        principles: [" Be kind ", "", "Be curious"],
      }),
    ).toEqual({
      vision: "A clear future",
      purpose: null,
      principles: ["Be kind", "Be curious"],
    });
  });

  it("uses empty values when optional fields are omitted", () => {
    expect(sanitizeFocusProfile({})).toEqual({
      vision: null,
      purpose: null,
      principles: [],
    });
  });

  it("rejects malformed lists and overlong values without returning a partial profile", () => {
    expect(sanitizeFocusProfile({ vision: "ok", principles: [1] })).toBeNull();
    expect(sanitizeFocusProfile({ vision: "x".repeat(10001) })).toBeNull();
    expect(sanitizeFocusProfile({ principles: ["x".repeat(501)] })).toBeNull();
    expect(sanitizeFocusProfile(null)).toBeNull();
  });
});

describe("sanitizeAreaInput", () => {
  it("trims bounded Area fields and normalizes an empty description", () => {
    expect(
      sanitizeAreaInput({ name: "  Family  ", description: "   " }),
    ).toEqual({ name: "Family", description: null });
  });

  it("rejects blank names, invalid values, and overlong fields", () => {
    expect(sanitizeAreaInput({ name: "  " })).toBeNull();
    expect(sanitizeAreaInput({ name: "x".repeat(201) })).toBeNull();
    expect(sanitizeAreaInput({ name: "Family", description: "x".repeat(5001) })).toBeNull();
    expect(sanitizeAreaInput({ name: "Family", description: 42 })).toBeNull();
    expect(sanitizeAreaInput([])).toBeNull();
  });
});