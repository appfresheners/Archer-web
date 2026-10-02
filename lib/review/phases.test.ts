import { describe, expect, it } from "vitest";
import {
  isBookend,
  isReviewShellPhase,
  nextPhase,
  PHASE_COUNT,
  PHASE_LABELS,
  phaseIndex,
  prevPhase,
  REVIEW_PHASES,
} from "./phases";

describe("REVIEW_PHASES", () => {
  it("is the five beats in the canonical order", () => {
    expect([...REVIEW_PHASES]).toEqual([
      "snapshot_open",
      "get_clear",
      "get_current",
      "get_creative",
      "snapshot_close",
    ]);
    expect(PHASE_COUNT).toBe(5);
  });

  it("has a label for every beat", () => {
    for (const phase of REVIEW_PHASES) {
      expect(PHASE_LABELS[phase]).toBeTruthy();
    }
  });
});

describe("phaseIndex", () => {
  it("returns the 0-based position for each beat", () => {
    expect(phaseIndex("snapshot_open")).toBe(0);
    expect(phaseIndex("get_current")).toBe(2);
    expect(phaseIndex("snapshot_close")).toBe(4);
  });

  it("returns -1 for the terminal 'complete' phase (not a beat)", () => {
    expect(phaseIndex("complete")).toBe(-1);
  });
});

describe("nextPhase", () => {
  it("advances one beat at a time", () => {
    expect(nextPhase("snapshot_open")).toBe("get_clear");
    expect(nextPhase("get_clear")).toBe("get_current");
    expect(nextPhase("get_current")).toBe("get_creative");
    expect(nextPhase("get_creative")).toBe("snapshot_close");
  });

  it("returns null at the last beat (no next past snapshot_close)", () => {
    expect(nextPhase("snapshot_close")).toBeNull();
  });

  it("returns null for a non-beat phase", () => {
    expect(nextPhase("complete")).toBeNull();
  });
});

describe("prevPhase", () => {
  it("steps back one beat at a time", () => {
    expect(prevPhase("snapshot_close")).toBe("get_creative");
    expect(prevPhase("get_creative")).toBe("get_current");
    expect(prevPhase("get_current")).toBe("get_clear");
    expect(prevPhase("get_clear")).toBe("snapshot_open");
  });

  it("returns null at the first beat (no prev before snapshot_open)", () => {
    expect(prevPhase("snapshot_open")).toBeNull();
  });

  it("returns null for a non-beat phase", () => {
    expect(prevPhase("complete")).toBeNull();
  });
});

describe("isBookend", () => {
  it("flags only the two snapshot beats", () => {
    expect(isBookend("snapshot_open")).toBe(true);
    expect(isBookend("snapshot_close")).toBe(true);
    expect(isBookend("get_clear")).toBe(false);
    expect(isBookend("get_current")).toBe(false);
    expect(isBookend("get_creative")).toBe(false);
  });
});

describe("isReviewShellPhase", () => {
  it("accepts the five beats and rejects everything else", () => {
    expect(isReviewShellPhase("get_clear")).toBe(true);
    expect(isReviewShellPhase("snapshot_open")).toBe(true);
    expect(isReviewShellPhase("complete")).toBe(false);
    expect(isReviewShellPhase("nope")).toBe(false);
    expect(isReviewShellPhase(null)).toBe(false);
    expect(isReviewShellPhase(2)).toBe(false);
  });
});
