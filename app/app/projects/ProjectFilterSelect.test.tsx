import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProjectFilterSelect from "./ProjectFilterSelect";

describe("ProjectFilterSelect", () => {
  it("preserves project search and unrelated params when applying No goal", () => {
    const { container } = render(
      <ProjectFilterSelect
        goals={[]}
        goalOptionsError={false}
        selectedGoal={null}
        value="all"
        query=""
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

  it("filters goal links locally while preserving the applied filter and URL state", () => {
    render(
      <ProjectFilterSelect
        goals={[
          { id: "goal-1", goal_text: "Run a marathon" },
          { id: "goal-2", goal_text: "Launch a newsletter" },
        ]}
        goalOptionsError={false}
        selectedGoal={{ id: "goal-1", goal_text: "Run a marathon" }}
        value="goal-1"
        query="run"
        searchParams={{ goal: "goal-1", q: "training", page: "3", view: "compact", goalQ: "run" }}
      />,
    );

    const filter = screen.getByRole("combobox", { name: "Filter by goal" });
    expect(filter).toHaveValue("goal-1");
    const clearUrl = new URL(
      screen.getByRole("link", { name: "Clear search" }).getAttribute("href")!,
      "http://localhost",
    );
    expect(clearUrl.searchParams.get("goal")).toBe("goal-1");
    expect(clearUrl.searchParams.get("q")).toBe("training");
    expect(clearUrl.searchParams.get("page")).toBe("3");
    expect(clearUrl.searchParams.get("view")).toBe("compact");
    expect(clearUrl.searchParams.has("goalQ")).toBe(false);
    expect(clearUrl.searchParams.has("goalOptionsPage")).toBe(false);
    expect(screen.getByRole("option", { name: "All goals" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No goal" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Run a marathon" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Launch a newsletter" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Run a marathon" })).toHaveAttribute("aria-current", "true");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search goals to filter projects" }), {
      target: { value: "NEWSLETTER" },
    });

    const goalLink = screen.getByRole("link", { name: "Launch a newsletter" });
    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Run a marathon" })).not.toBeInTheDocument();
    const url = new URL(goalLink.getAttribute("href")!, "http://localhost");
    expect(url.pathname).toBe("/app/projects");
    expect(url.searchParams.get("goal")).toBe("goal-2");
    expect(url.searchParams.get("q")).toBe("training");
    expect(url.searchParams.get("view")).toBe("compact");
    expect(url.searchParams.has("page")).toBe(false);
    expect(url.searchParams.has("goalQ")).toBe(false);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search goals to filter projects" }), {
      target: { value: "no such goal" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("No goals match 'no such goal'.");
    expect(screen.getByRole("combobox", { name: "Filter by goal" })).toHaveValue("goal-1");
  });

  it("caps visible goal matches at 50 and prompts for a narrower query", () => {
    const goals = Array.from({ length: 55 }, (_, index) => ({
      id: `goal-${index}`,
      goal_text: `Goal ${index}`,
    }));
    render(
      <ProjectFilterSelect
        goals={goals}
        goalOptionsError={false}
        selectedGoal={null}
        value="all"
        query="goal"
        searchParams={{ goalQ: "goal" }}
      />,
    );

    expect(within(screen.getByRole("list")).getAllByRole("link")).toHaveLength(50);
    expect(screen.getByText("Keep typing to narrow results")).toBeInTheDocument();
  });
});