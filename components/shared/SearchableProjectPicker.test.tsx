import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SearchableProjectPicker, { type SearchableProjectOption } from "./SearchableProjectPicker";

const options: SearchableProjectOption[] = [
  {
    id: "p1",
    name: "Base Training",
    status: "paused",
    goal_id: "g1",
    parent_goal_text: "Run a marathon",
  },
  {
    id: "p2",
    name: "Kitchen update",
    status: "active",
    goal_id: null,
    parent_goal_text: null,
  },
  {
    id: "p3",
    name: "Archived work",
    status: "archived",
    goal_id: null,
    parent_goal_text: null,
  },
  {
    id: "p4",
    name: "Completed work",
    status: "completed",
    goal_id: null,
    parent_goal_text: null,
  },
];

describe("SearchableProjectPicker", () => {
  it("filters case-insensitively and displays parent-goal context", async () => {
    const user = userEvent.setup();
    render(
      <SearchableProjectPicker
        label="Project"
        options={options}
        value=""
        onValueChange={vi.fn()}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Project" });
    await user.type(input, "bAsE");

    const listbox = screen.getByRole("listbox", { name: "Project options" });
    expect(within(listbox).getByRole("option")).toHaveTextContent("Base Training");
    expect(within(listbox).getByRole("option")).toHaveTextContent("Run a marathon");
    expect(within(listbox).queryByText("Archived work")).not.toBeInTheDocument();
    expect(within(listbox).queryByText("Completed work")).not.toBeInTheDocument();
    expect(screen.getByText("1 matching project for bAsE")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("announces no matches, shows feedback, and lets the query be cleared", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SearchableProjectPicker
        label="Project"
        options={options}
        value=""
        onValueChange={onValueChange}
        allowClear
      />,
    );

    const input = screen.getByRole("combobox", { name: "Project" });
    await user.type(input, "unknown");
    expect(screen.getByRole("status")).toHaveTextContent("No projects match");
    expect(screen.getByText("0 matching projects for unknown")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onValueChange).toHaveBeenCalledWith("");
    expect(input).toHaveValue("");
  });

  it("announces a changed query even when the match count stays the same", async () => {
    const user = userEvent.setup();
    render(
      <SearchableProjectPicker
        label="Project"
        options={options}
        value=""
        onValueChange={vi.fn()}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Project" });
    await user.type(input, "base");
    expect(screen.getByText("1 matching project for base")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "training");
    expect(screen.getByText("1 matching project for training")).toBeInTheDocument();
  });

  it("supports active-descendant keyboard navigation, selection, Escape, and Tab", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <SearchableProjectPicker
          label="Project"
          options={options}
          value=""
          onValueChange={onValueChange}
        />
        <button type="button">Next field</button>
      </>,
    );

    const input = screen.getByRole("combobox", { name: "Project" });
    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringContaining("p1"));
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringContaining("p2"));
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("p1");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await user.click(input);
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await user.click(input);
    await user.tab();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Next field" })).toHaveFocus();
  });

  it("closes the option list when focus moves elsewhere", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SearchableProjectPicker
          label="Project"
          options={options}
          value=""
          onValueChange={vi.fn()}
        />
        <button type="button">Outside control</button>
      </>,
    );

    const input = screen.getByRole("combobox", { name: "Project" });
    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Outside control" }));
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the current selection and scrolls keyboard-active options into view", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      const user = userEvent.setup();
      render(
        <SearchableProjectPicker
          label="Project"
          options={options}
          value="p1"
          onValueChange={vi.fn()}
        />,
      );

      const input = screen.getByRole("combobox", { name: "Project" });
      await user.click(input);
      const selectedOption = screen.getByRole("option", { name: /Base Training/ });
      expect(selectedOption).toHaveAttribute("aria-selected", "true");
      expect(selectedOption).toHaveClass("border-l-2");

      await user.keyboard("{ArrowDown}");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollIntoView",
          originalDescriptor,
        );
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
    }
  });

  it("renders at most 50 options and asks the user to narrow larger result sets", async () => {
    const user = userEvent.setup();
    const manyOptions = Array.from({ length: 55 }, (_, index) => ({
      id: `p${index}`,
      name: `Project ${index}`,
      status: "active" as const,
      goal_id: null,
      parent_goal_text: null,
    }));
    render(
      <SearchableProjectPicker
        label="Project"
        options={manyOptions}
        value=""
        onValueChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Project" }));
    expect(screen.getAllByRole("option")).toHaveLength(50);
    expect(screen.getByText("Keep typing to narrow results")).toBeInTheDocument();
    expect(screen.getByText("55 matching projects")).toBeInTheDocument();
  });

  it("shows the empty-options message", async () => {
    const user = userEvent.setup();
    render(
      <SearchableProjectPicker
        label="Attach existing project"
        options={[]}
        value=""
        onValueChange={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole("combobox", { name: "Attach existing project" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Attach existing project" }));
    expect(screen.getByRole("status")).toHaveTextContent("No projects available");
  });
});