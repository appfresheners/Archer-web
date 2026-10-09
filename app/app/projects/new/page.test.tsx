import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NewProjectPage from "./page";

const { loadAreas, loadGoals, projectClient } = vi.hoisted(() => ({
  loadAreas: vi.fn(),
  loadGoals: vi.fn(),
  projectClient: vi.fn(),
}));

vi.mock("./load-goals", () => ({
  loadAreasForPicker: loadAreas,
  loadGoalsForPicker: loadGoals,
}));

vi.mock("./NewProjectClient", () => ({
  default: ({
    areas,
    goals,
  }: {
    areas: { id: string; name: string }[];
    goals: { id: string; goal_text: string }[];
  }) => {
    projectClient(areas, goals);
    return <div data-testid="project-client">{areas.map((area) => area.name).join(", ")}</div>;
  },
}));

describe("NewProjectPage", () => {
  it("passes active Area options and Goals to the project form", async () => {
    loadAreas.mockResolvedValue([{ id: "area-1", name: "Health" }]);
    loadGoals.mockResolvedValue([{ id: "goal-1", goal_text: "Run a marathon" }]);

    render(await NewProjectPage());

    expect(screen.getByTestId("project-client")).toHaveTextContent("Health");
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("New project");
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/app/projects");
    expect(projectClient).toHaveBeenCalledWith(
      [{ id: "area-1", name: "Health" }],
      [{ id: "goal-1", goal_text: "Run a marathon" }],
    );
  });
});