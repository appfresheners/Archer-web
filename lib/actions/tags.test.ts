import { describe, expect, it } from "vitest";
import { isValidContextTag, sanitizeContextTags } from "./tags";

describe("isValidContextTag", () => {
  it("accepts valid @key:value tags for known keys", () => {
    expect(isValidContextTag("@energy:high")).toBe(true);
    expect(isValidContextTag("@location:home")).toBe(true);
    expect(isValidContextTag("@location:home-office")).toBe(true);
    expect(isValidContextTag("@energy:medium")).toBe(true);
    expect(isValidContextTag("@tool:laptop")).toBe(false);
    expect(isValidContextTag("@location:my-custom-place")).toBe(false);
    expect(isValidContextTag("@energy:very-high")).toBe(false);
  });

  it("rejects unknown keys, malformed, or non-string tags", () => {
    expect(isValidContextTag("@mood:great")).toBe(false);
    expect(isValidContextTag("energy:high")).toBe(false);
    expect(isValidContextTag("@energy:")).toBe(false);
    expect(isValidContextTag("@energy: ")).toBe(false);
    expect(isValidContextTag(42)).toBe(false);
  });
});

describe("sanitizeContextTags", () => {
  it("returns [] for null/undefined (untagged is valid)", () => {
    expect(sanitizeContextTags(null)).toEqual([]);
    expect(sanitizeContextTags(undefined)).toEqual([]);
    expect(sanitizeContextTags([])).toEqual([]);
  });

  it("normalizes case, trims value, and dedupes", () => {
    expect(
      sanitizeContextTags(["@Energy:High", "@energy:high", " @location:home "]),
    ).toEqual(["@energy:high", "@location:home"]);
  });

  it("accepts entries with or without the leading @", () => {
    expect(sanitizeContextTags(["location:home-office"])).toEqual([
      "@location:home-office",
    ]);
  });

  it("returns null when any entry is malformed or an unknown key", () => {
    expect(sanitizeContextTags(["@mood:great"])).toBeNull();
    expect(sanitizeContextTags(["@tool:laptop"])).toBeNull();
    expect(sanitizeContextTags(["@location:custom-place"])).toBeNull();
    expect(sanitizeContextTags(["@energy:very-high"])).toBeNull();
    expect(sanitizeContextTags(["@energy:"])).toBeNull();
    expect(sanitizeContextTags(["not a tag"])).toBeNull();
    expect(sanitizeContextTags([123])).toBeNull();
    expect(sanitizeContextTags("nope")).toBeNull();
  });

  it("allows an unlisted tag only when retaining it from an existing action", () => {
    expect(sanitizeContextTags(["@tool:laptop"])).toBeNull();
    expect(
      sanitizeContextTags(
        ["@tool:laptop", "@location:office"],
        ["@tool:laptop"],
      ),
    ).toEqual(["@tool:laptop", "@location:office"]);
    expect(sanitizeContextTags(["@tool:phone"], ["@tool:laptop"])).toBeNull();
  });
});
