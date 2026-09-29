import { describe, expect, it } from "vitest";
import { MAX_INBOX_TEXT, sanitizeInboxText } from "./validate";

describe("sanitizeInboxText", () => {
  it("trims and accepts 1..2000 chars", () => {
    expect(sanitizeInboxText("  Buy milk  ")).toBe("Buy milk");
    expect(sanitizeInboxText("x".repeat(MAX_INBOX_TEXT))).toHaveLength(
      MAX_INBOX_TEXT,
    );
  });

  it("rejects empty / whitespace-only text", () => {
    expect(sanitizeInboxText("")).toBeNull();
    expect(sanitizeInboxText("   ")).toBeNull();
    expect(sanitizeInboxText("\n\t ")).toBeNull();
  });

  it("rejects over-length text (> 2000 chars)", () => {
    expect(sanitizeInboxText("x".repeat(MAX_INBOX_TEXT + 1))).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(sanitizeInboxText(5)).toBeNull();
    expect(sanitizeInboxText(null)).toBeNull();
    expect(sanitizeInboxText(undefined)).toBeNull();
    expect(sanitizeInboxText({})).toBeNull();
  });
});
