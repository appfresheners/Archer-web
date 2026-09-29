import { describe, expect, it } from "vitest";
import { daysSince, isUnprocessedOverdue, OVERDUE_DAYS } from "./overdue";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 28, 12, 0, 0); // fixed reference "now"

function isoDaysAgo(days: number): string {
  return new Date(NOW - days * DAY_MS).toISOString();
}

describe("daysSince", () => {
  it("computes fractional days in millisecond precision", () => {
    expect(daysSince(isoDaysAgo(1), NOW)).toBeCloseTo(1, 6);
    expect(daysSince(isoDaysAgo(7.5), NOW)).toBeCloseTo(7.5, 6);
  });

  it("returns NaN for an unparseable timestamp", () => {
    expect(Number.isNaN(daysSince("not-a-date", NOW))).toBe(true);
  });
});

describe("isUnprocessedOverdue", () => {
  it("does NOT flag an item captured exactly 7 days ago (boundary)", () => {
    expect(
      isUnprocessedOverdue(
        { processing_status: "unprocessed", captured_at: isoDaysAgo(OVERDUE_DAYS) },
        NOW,
      ),
    ).toBe(false);
  });

  it("flags an unprocessed item captured strictly more than 7 days ago", () => {
    expect(
      isUnprocessedOverdue(
        { processing_status: "unprocessed", captured_at: isoDaysAgo(7.001) },
        NOW,
      ),
    ).toBe(true);
    expect(
      isUnprocessedOverdue(
        { processing_status: "unprocessed", captured_at: isoDaysAgo(30) },
        NOW,
      ),
    ).toBe(true);
  });

  it("does not flag a recent unprocessed item", () => {
    expect(
      isUnprocessedOverdue(
        { processing_status: "unprocessed", captured_at: isoDaysAgo(1) },
        NOW,
      ),
    ).toBe(false);
  });

  it("never flags processed or trashed items regardless of age", () => {
    expect(
      isUnprocessedOverdue(
        { processing_status: "processed", captured_at: isoDaysAgo(30) },
        NOW,
      ),
    ).toBe(false);
    expect(
      isUnprocessedOverdue(
        { processing_status: "trashed", captured_at: isoDaysAgo(30) },
        NOW,
      ),
    ).toBe(false);
  });

  it("does not flag an item with an unparseable captured_at", () => {
    expect(
      isUnprocessedOverdue(
        { processing_status: "unprocessed", captured_at: "garbage" },
        NOW,
      ),
    ).toBe(false);
  });
});
