import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ContextTagEditor from "./ContextTagEditor";

describe("ContextTagEditor", () => {
  it("builds a normalized @key:value tag on add and dedupes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ContextTagEditor tags={[]} onChange={onChange} />);

    // Default key is @energy.
    await user.type(screen.getByLabelText("Context tag value"), "high");
    await user.click(screen.getByRole("button", { name: "Add tag" }));

    expect(onChange).toHaveBeenCalledWith(["@energy:high"]);
  });

  it("adds a tag for a chosen key", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ContextTagEditor tags={[]} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Context tag type"), "location");
    await user.type(screen.getByLabelText("Context tag value"), "home");
    await user.click(screen.getByRole("button", { name: "Add tag" }));

    expect(onChange).toHaveBeenCalledWith(["@location:home"]);
  });

  it("does not add a duplicate tag", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ContextTagEditor tags={["@energy:high"]} onChange={onChange} />);

    await user.type(screen.getByLabelText("Context tag value"), "high");
    await user.click(screen.getByRole("button", { name: "Add tag" }));

    // Already present → no change emitted.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag via its chip control", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ContextTagEditor
        tags={["@energy:high", "@tool:laptop"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove @energy:high" }));
    expect(onChange).toHaveBeenCalledWith(["@tool:laptop"]);
  });
});
