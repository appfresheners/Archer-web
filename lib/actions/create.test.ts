import { describe, expect, it } from "vitest";
import { isCalendarDate, sanitizeActionCreate } from "./create";

const PID = "33333333-3333-4333-8333-333333333333";

describe("isCalendarDate", () => {
  it("accepts a real YYYY-MM-DD date", () => {
    expect(isCalendarDate("2026-02-28")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true); // leap year
  });
  it("rejects malformed or impossible dates", () => {
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2025-02-29")).toBe(false); // non-leap
    expect(isCalendarDate("2026/02/28")).toBe(false);
    expect(isCalendarDate("not-a-date")).toBe(false);
    expect(isCalendarDate(123)).toBe(false);
    expect(isCalendarDate(null)).toBe(false);
  });
});

describe("sanitizeActionCreate", () => {
  it("standalone next action: text only → project_id null, available", () => {
    expect(sanitizeActionCreate({ text: "  Call the dentist " })).toEqual({
      text: "Call the dentist",
      project_id: null,
      status: "available",
      delegated_to: null,
      scheduled_for: null,
    });
  });

  it("waiting/delegate: requires delegated_to and keeps it", () => {
    expect(
      sanitizeActionCreate({
        text: "Wait on tax docs",
        status: "waiting",
        delegated_to: "  Sam  ",
      }),
    ).toEqual({
      text: "Wait on tax docs",
      project_id: null,
      status: "waiting",
      delegated_to: "Sam",
      scheduled_for: null,
    });
  });

  it("rejects waiting with an empty/missing delegated_to", () => {
    expect(
      sanitizeActionCreate({ text: "x", status: "waiting" }),
    ).toBeNull();
    expect(
      sanitizeActionCreate({ text: "x", status: "waiting", delegated_to: "   " }),
    ).toBeNull();
  });

  it("drops delegated_to when not waiting (only meaningful for waiting)", () => {
    const patch = sanitizeActionCreate({
      text: "x",
      status: "available",
      delegated_to: "Sam",
    });
    expect(patch?.delegated_to).toBeNull();
  });

  it("calendar defer: keeps a valid scheduled_for date", () => {
    expect(
      sanitizeActionCreate({ text: "Renew passport", scheduled_for: "2026-06-01" }),
    ).toEqual({
      text: "Renew passport",
      project_id: null,
      status: "available",
      delegated_to: null,
      scheduled_for: "2026-06-01",
    });
  });

  it("rejects an invalid scheduled_for date", () => {
    expect(
      sanitizeActionCreate({ text: "x", scheduled_for: "2026-02-30" }),
    ).toBeNull();
  });

  it("assigned-project: keeps a uuid project_id", () => {
    const patch = sanitizeActionCreate({ text: "Draft spec", project_id: PID });
    expect(patch?.project_id).toBe(PID);
  });

  it("allows explicit null project_id (standalone)", () => {
    const patch = sanitizeActionCreate({ text: "x", project_id: null });
    expect(patch?.project_id).toBeNull();
  });

  it("rejects a non-uuid project_id", () => {
    expect(sanitizeActionCreate({ text: "x", project_id: "p1" })).toBeNull();
  });

  it("rejects an unknown status", () => {
    expect(sanitizeActionCreate({ text: "x", status: "committed" })).toBeNull();
    expect(sanitizeActionCreate({ text: "x", status: "done" })).toBeNull();
  });

  it("rejects empty/oversized/non-string text", () => {
    expect(sanitizeActionCreate({ text: "   " })).toBeNull();
    expect(sanitizeActionCreate({ text: "x".repeat(501) })).toBeNull();
    expect(sanitizeActionCreate({ text: 5 })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(sanitizeActionCreate(null)).toBeNull();
    expect(sanitizeActionCreate("x")).toBeNull();
    expect(sanitizeActionCreate([])).toBeNull();
  });
});
