import { describe, expect, it } from "vitest";
import { labelForPath, safeFrom, withFrom } from "./from";

describe("safeFrom", () => {
  it("accepts known /app paths", () => {
    expect(safeFrom("/app/review")).toBe("/app/review");
    expect(safeFrom("/app/goals/abc")).toBe("/app/goals/abc");
  });
  it("rejects external, protocol-relative, and unknown values", () => {
    for (const v of ["https://evil.com", "//evil.com", "/app//x\\y", "/apple", "/other", "", undefined]) {
      expect(safeFrom(v)).toBeNull();
    }
  });
  it("uses the first of repeated params", () => {
    expect(safeFrom(["/app/engage", "x"])).toBe("/app/engage");
  });
});

describe("labelForPath / withFrom", () => {
  it("labels", () => {
    expect(labelForPath("/app/review")).toBe("Weekly review");
  });
  it("appends from and keeps the hash", () => {
    expect(withFrom("/app/projects/p1#actions", "/app/review")).toBe(
      "/app/projects/p1?from=%2Fapp%2Freview#actions",
    );
  });
});
