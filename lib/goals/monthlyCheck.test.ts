import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMonthlyGoalCheckCutoff,
  isMonthlyGoalCheckDue,
  MONTHLY_GOAL_CHECK_INTERVAL_MS,
} from "./monthlyCheck";

const now = new Date("2026-10-01T12:00:00.000Z");

afterEach(() => {
  vi.useRealTimers();
});

function goal(overrides: Partial<Parameters<typeof isMonthlyGoalCheckDue>[0]> = {}) {
  return {
    status: "active" as const,
    last_checked_at: null,
    created_at: new Date(now.getTime() - MONTHLY_GOAL_CHECK_INTERVAL_MS).toISOString(),
    ...overrides,
  };
}

describe("isMonthlyGoalCheckDue", () => {
  it("is due at the exact 30-day boundary", () => {
    expect(isMonthlyGoalCheckDue(goal(), now)).toBe(true);
  });

  it("is not due before the 30-day boundary", () => {
    expect(
      isMonthlyGoalCheckDue(
        goal({ created_at: new Date(now.getTime() - MONTHLY_GOAL_CHECK_INTERVAL_MS + 1).toISOString() }),
        now,
      ),
    ).toBe(false);
  });

  it("uses last_checked_at instead of created_at when available", () => {
    expect(
      isMonthlyGoalCheckDue(
        goal({
          created_at: "2020-01-01T00:00:00.000Z",
          last_checked_at: now.toISOString(),
        }),
        now,
      ),
    ).toBe(false);
  });

  it("only prompts Active goals", () => {
    expect(isMonthlyGoalCheckDue(goal({ status: "paused" }), now)).toBe(false);
    expect(isMonthlyGoalCheckDue(goal({ status: "completed" }), now)).toBe(false);
  });

  it("does not treat invalid or future timestamps as due", () => {
    expect(isMonthlyGoalCheckDue(goal({ created_at: "invalid" }), now)).toBe(false);
    expect(
      isMonthlyGoalCheckDue(
        goal({ created_at: new Date(now.getTime() + 1).toISOString() }),
        now,
      ),
    ).toBe(false);
  });
});

describe("getMonthlyGoalCheckCutoff", () => {
  it("returns exactly 30 days before the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(getMonthlyGoalCheckCutoff()).toBe(
      new Date(now.getTime() - MONTHLY_GOAL_CHECK_INTERVAL_MS).toISOString(),
    );
  });
});