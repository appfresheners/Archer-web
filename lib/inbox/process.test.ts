import { describe, expect, it } from "vitest";
import { isProcessedStatus, isUuid, sanitizeInboxProcess } from "./process";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("isProcessedStatus", () => {
  it("accepts the four terminal statuses", () => {
    for (const s of ["processed", "trashed", "someday", "reference"]) {
      expect(isProcessedStatus(s)).toBe(true);
    }
  });

  it("rejects unprocessed and unknown values", () => {
    expect(isProcessedStatus("unprocessed")).toBe(false);
    expect(isProcessedStatus("available")).toBe(false);
    expect(isProcessedStatus(1)).toBe(false);
    expect(isProcessedStatus(null)).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts a canonical uuid", () => {
    expect(isUuid(UUID)).toBe(true);
  });
  it("rejects non-uuid strings and non-strings", () => {
    expect(isUuid("nope")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe("sanitizeInboxProcess", () => {
  // Matrix rows: Trash / Someday / Reference / Do-it (processed).
  it.each(["processed", "trashed", "someday", "reference"] as const)(
    "accepts the terminal status %s",
    (status) => {
      expect(sanitizeInboxProcess({ status })).toEqual({
        processing_status: status,
      });
    },
  );

  it("does not set processed_at (route stamps it)", () => {
    const patch = sanitizeInboxProcess({ status: "processed" });
    expect(patch && "processed_at" in patch).toBe(false);
  });

  it("accepts an optional resolved_project_id uuid (multistep link)", () => {
    expect(
      sanitizeInboxProcess({ status: "processed", resolved_project_id: UUID }),
    ).toEqual({ processing_status: "processed", resolved_project_id: UUID });
  });

  it("allows clearing resolved_project_id with null", () => {
    expect(
      sanitizeInboxProcess({ status: "processed", resolved_project_id: null }),
    ).toEqual({ processing_status: "processed", resolved_project_id: null });
  });

  it("rejects a non-uuid resolved_project_id", () => {
    expect(
      sanitizeInboxProcess({ status: "processed", resolved_project_id: "abc" }),
    ).toBeNull();
  });

  it.each(["trashed", "someday", "reference"] as const)(
    "rejects a resolved_project_id paired with the non-actionable status %s",
    (status) => {
      // Linking a trashed/someday/reference item to a project is nonsensical.
      expect(
        sanitizeInboxProcess({ status, resolved_project_id: UUID }),
      ).toBeNull();
    },
  );

  it("rejects a missing/invalid status", () => {
    expect(sanitizeInboxProcess({})).toBeNull();
    expect(sanitizeInboxProcess({ status: "nope" })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(sanitizeInboxProcess(null)).toBeNull();
    expect(sanitizeInboxProcess("x")).toBeNull();
    expect(sanitizeInboxProcess([])).toBeNull();
  });
});

// Story 5.6 — reactivation path (someday/reference → unprocessed).
describe("sanitizeInboxProcess — reactivate (unprocessed)", () => {
  it("accepts unprocessed and clears processed_at + resolved_project_id", () => {
    expect(sanitizeInboxProcess({ status: "unprocessed" })).toEqual({
      processing_status: "unprocessed",
      processed_at: null,
      resolved_project_id: null,
    });
  });

  it("tolerates an explicit null resolved_project_id on the reactivate path", () => {
    expect(
      sanitizeInboxProcess({ status: "unprocessed", resolved_project_id: null }),
    ).toEqual({
      processing_status: "unprocessed",
      processed_at: null,
      resolved_project_id: null,
    });
  });

  it("rejects a resolved_project_id paired with unprocessed (nonsensical)", () => {
    const UUID = "11111111-1111-4111-8111-111111111111";
    expect(
      sanitizeInboxProcess({ status: "unprocessed", resolved_project_id: UUID }),
    ).toBeNull();
  });

  it("still accepts the four terminal statuses unchanged (clarify path intact)", () => {
    for (const s of ["processed", "trashed", "someday", "reference"] as const) {
      const patch = sanitizeInboxProcess({ status: s });
      expect(patch?.processing_status).toBe(s);
      // Terminal statuses do NOT set processed_at here (route stamps it) and do
      // NOT null out resolved_project_id.
      expect(patch && "processed_at" in patch).toBe(false);
    }
  });
});
