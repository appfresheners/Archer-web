import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GoalRow, { type GoalRowData } from "./GoalRow";

const base: GoalRowData = {
  id: "g1",
  goal_text: "Learn to run a marathon",
  status: "active",
  target_date: "2026-12-31",
  projectCount: 3,
  stuckCount: 0,
};

function renderRow(overrides: Partial<GoalRowData> = {}) {
  return render(<GoalRow goal={{ ...base, ...overrides }} />);
}

describe("GoalRow", () => {
  it("links the whole row to the goal detail route", () => {
    renderRow();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/app/goals/g1");
  });

  it("formats the target date as a short label", () => {
    renderRow({ target_date: "2026-12-31" });
    expect(screen.getByText(/Target Dec 31, 2026/)).toBeInTheDocument();
  });

  it("falls back to the raw value for an unparseable date", () => {
    renderRow({ target_date: "not-a-date" });
    expect(screen.getByText(/Target not-a-date/)).toBeInTheDocument();
  });

  it("uses the singular project label for exactly one project", () => {
    renderRow({ projectCount: 1 });
    expect(screen.getByText("1 project")).toBeInTheDocument();
  });

  it("uses the plural project label otherwise", () => {
    renderRow({ projectCount: 3 });
    expect(screen.getByText("3 projects")).toBeInTheDocument();
  });

  it("hides the stuck pill when there are no stuck projects", () => {
    renderRow({ stuckCount: 0 });
    expect(screen.queryByText(/stuck project/)).not.toBeInTheDocument();
  });

  it("shows a singular stuck label for one stuck project", () => {
    renderRow({ stuckCount: 1 });
    expect(screen.getByText("1 stuck project")).toBeInTheDocument();
  });

  it("shows a plural stuck label for multiple stuck projects", () => {
    renderRow({ stuckCount: 4 });
    expect(screen.getByText("4 stuck projects")).toBeInTheDocument();
  });

  it("renders the status badge", () => {
    renderRow({ status: "paused" });
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });
});
