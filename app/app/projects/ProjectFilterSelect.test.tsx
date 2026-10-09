import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProjectFilterSelect from "./ProjectFilterSelect";

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

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

  it("filters goal options locally while preserving the applied filter and URL state", () => {
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
    const goalSearch = screen.getByRole("combobox", {
      name: "Search goals to filter projects",
    });
    fireEvent.focus(goalSearch);
    expect(goalSearch).toHaveValue("");
    const listbox = screen.getByRole("listbox", { name: "Matching goals" });
    expect(within(listbox).getAllByRole("option")).toHaveLength(2);
    expect(within(listbox).getByRole("option", { name: "Run a marathon" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.change(goalSearch, {
      target: { value: "NEWSLETTER" },
    });

    const goalOption = within(listbox).getByRole("option", { name: "Launch a newsletter" });
    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "Run a marathon" })).not.toBeInTheDocument();
    fireEvent.click(goalOption);
    expect(routerPush).toHaveBeenCalledWith(
      "/app/projects?q=training&view=compact&goal=goal-2",
    );

    fireEvent.change(goalSearch, {
      target: { value: "no such goal" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("No goals match");
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

    fireEvent.focus(
      screen.getByRole("combobox", { name: "Search goals to filter projects" }),
    );
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(50);
    expect(screen.getByText("Keep typing to narrow results")).toBeInTheDocument();
  });

  it("opens all loaded goals on focus and selects the active goal with the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <ProjectFilterSelect
        goals={[
          { id: "goal-1", goal_text: "Run a marathon" },
          { id: "goal-2", goal_text: "Launch a newsletter" },
        ]}
        goalOptionsError={false}
        selectedGoal={null}
        value="all"
        query=""
        searchParams={{ q: "training", view: "compact" }}
      />,
    );

    const goalSearch = screen.getByRole("combobox", {
      name: "Search goals to filter projects",
    });
    expect(goalSearch).toHaveAttribute("aria-expanded", "false");
    await user.click(goalSearch);
    expect(goalSearch).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(2);

    await user.keyboard("{ArrowDown}");
    expect(goalSearch).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("goal-1"),
    );
    await user.keyboard("{Escape}");
    expect(goalSearch).toHaveAttribute("aria-expanded", "false");
    expect(goalSearch).not.toHaveAttribute("aria-activedescendant");

    await user.click(goalSearch);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(goalSearch).not.toHaveAttribute("aria-activedescendant");
    expect(routerPush).toHaveBeenCalledWith(
      "/app/projects?q=training&view=compact&goal=goal-1",
    );
  });

  it("shows an empty-goals state when the focused picker has no options", () => {
    render(
      <ProjectFilterSelect
        goals={[]}
        goalOptionsError={false}
        selectedGoal={null}
        value="all"
        query=""
        searchParams={{}}
      />,
    );

    fireEvent.focus(
      screen.getByRole("combobox", { name: "Search goals to filter projects" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("No goals available");
  });
});