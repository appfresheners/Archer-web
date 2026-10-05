import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AreaSelect from "./AreaSelect";

describe("AreaSelect", () => {
  it("offers active Areas and no archived option for a new assignment", () => {
    render(
      <AreaSelect
        id="area"
        value=""
        areas={[{ id: "active", name: "Health" }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "Health" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /archived/i })).toBeNull();
    expect(screen.getByRole("option", { name: "No Area" })).toBeInTheDocument();
  });

  it("keeps a current archived Area visible but disabled while editing", () => {
    render(
      <AreaSelect
        id="area"
        value="archived"
        areas={[{ id: "active", name: "Health" }]}
        currentArchivedArea={{ id: "archived", name: "Work" }}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("option", { name: "Work (archived)" }),
    ).toBeDisabled();
  });

  it("reports the selected Area ID", () => {
    const onChange = vi.fn();
    render(
      <AreaSelect
        id="area"
        value=""
        areas={[{ id: "active", name: "Health" }]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Life Area (optional)"), {
      target: { value: "active" },
    });
    expect(onChange).toHaveBeenCalledWith("active");
  });
});