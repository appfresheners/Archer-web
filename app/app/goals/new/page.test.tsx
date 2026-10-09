import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NewGoalPage from "./page";

const { loadAreas, goalWizard } = vi.hoisted(() => ({
  loadAreas: vi.fn(),
  goalWizard: vi.fn(),
}));

vi.mock("@/app/app/projects/new/load-goals", () => ({
  loadAreasForPicker: loadAreas,
}));

vi.mock("./GoalWizard", () => ({
  default: ({ areas }: { areas: { id: string; name: string }[] }) => {
    goalWizard(areas);
    return <div data-testid="goal-wizard">{areas.map((area) => area.name).join(", ")}</div>;
  },
}));

describe("NewGoalPage", () => {
  it("passes active Area options to the Goal wizard", async () => {
    loadAreas.mockResolvedValue([{ id: "area-1", name: "Health" }]);

    render(await NewGoalPage());

    expect(screen.getByTestId("goal-wizard")).toHaveTextContent("Health");
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("New goal");
    expect(screen.getByRole("link", { name: "Goals" })).toHaveAttribute("href", "/app/goals");
    expect(goalWizard).toHaveBeenCalledWith([{ id: "area-1", name: "Health" }]);
  });
});