import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ContextTagEditor from "./ContextTagEditor";

describe("ContextTagEditor", () => {
  it("adds a selected energy option without free-text entry", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ContextTagEditor tags={[]} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Tag category"), "energy");
    await user.selectOptions(screen.getByLabelText("Select energy"), "high");
    await user.click(screen.getByRole("button", { name: "Add tag" }));

    expect(onChange).toHaveBeenCalledWith(["@energy:high"]);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("adds a tag for a chosen key", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ContextTagEditor tags={[]} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Tag category"), "location");
    await user.selectOptions(screen.getByLabelText("Select location"), "home");
    await user.click(screen.getByRole("button", { name: "Add tag" }));

    expect(onChange).toHaveBeenCalledWith(["@location:home"]);
  });

  it("does not add a duplicate tag", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ContextTagEditor tags={["@energy:high"]} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Tag category"), "energy");
    await user.selectOptions(screen.getByLabelText("Select energy"), "high");
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

  it("keeps one energy level when a different level is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ContextTagEditor
        tags={["@energy:low", "@location:home"]}
        onChange={onChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Tag category"), "energy");
    await user.selectOptions(screen.getByLabelText("Select energy"), "high");
    await user.click(screen.getByRole("button", { name: "Add tag" }));

    expect(onChange).toHaveBeenCalledWith(["@location:home", "@energy:high"]);
  });
});
