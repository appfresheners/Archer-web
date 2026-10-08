import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProjectFilterSelect from "./ProjectFilterSelect";

describe("ProjectFilterSelect", () => {
  it("preserves project search and unrelated params when applying No goal", () => {
    const { container } = render(
      <ProjectFilterSelect
        goals={[]}
        selectedGoal={null}
        value="all"
        query=""
        page={1}
        total={0}
        searchParams={{ q: "marathon", page: "3", view: "compact" }}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Filter by goal" }), {
      target: { value: "none" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "/app/projects");
    expect(form?.querySelector('[name="q"]')).toHaveAttribute("value", "marathon");
    expect(form?.querySelector('[name="page"]')).not.toBeInTheDocument();
    expect(form?.querySelector('[name="goalQ"]')).not.toBeInTheDocument();
  });

  it("exposes only All, No goal, and the selected goal in the select", () => {
    render(
      <ProjectFilterSelect
        goals={[{ id: "goal-2", goal_text: "Launch a newsletter" }]}
        selectedGoal={{ id: "goal-1", goal_text: "Run a marathon" }}
        value="goal-1"
        query="run"
        page={1}
        total={1}
        searchParams={{ goal: "goal-1", goalQ: "run" }}
      />,
    );

    const filter = screen.getByRole("combobox", { name: "Filter by goal" });
    expect(filter).toHaveValue("goal-1");
    expect(screen.getByRole("option", { name: "All goals" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No goal" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Run a marathon" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Launch a newsletter" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Launch a newsletter" })).toHaveAttribute(
      "href",
      "/app/projects?goal=goal-2",
    );
  });
});