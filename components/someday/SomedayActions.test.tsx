import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SomedayActions from "./SomedayActions";

const mockState = vi.hoisted(() => ({
  fetch: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockState.refresh }),
}));

describe("SomedayActions", () => {
  beforeEach(() => {
    mockState.fetch.mockReset();
    mockState.refresh.mockReset();
    vi.stubGlobal("fetch", mockState.fetch);
    mockState.fetch.mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reactivates an inbox item with the existing PATCH payload and refreshes", async () => {
    const user = userEvent.setup();
    render(<SomedayActions id="item-1" label="Learn pottery" type="item" />);

    await user.click(screen.getByRole("button", { name: "Reactivate Learn pottery" }));

    expect(mockState.fetch).toHaveBeenCalledWith("/api/inbox/item-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "unprocessed" }),
    });
    expect(mockState.refresh).toHaveBeenCalledOnce();
  });

  it("activates a Someday project by moving it to paused and refreshes", async () => {
    const user = userEvent.setup();
    render(<SomedayActions id="project-1" label="Build a kiln" type="project" />);

    await user.click(screen.getByRole("button", { name: "Activate Build a kiln" }));

    expect(mockState.fetch).toHaveBeenCalledWith("/api/projects/project-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    expect(mockState.refresh).toHaveBeenCalledOnce();
  });

  it("exposes pending state while a request is in flight", async () => {
    const user = userEvent.setup();
    let finishRequest!: (response: { ok: boolean }) => void;
    mockState.fetch.mockReturnValue(
      new Promise<{ ok: boolean }>((resolve) => {
        finishRequest = resolve;
      }),
    );
    render(<SomedayActions id="item-1" label="Learn pottery" type="item" />);
    const button = screen.getByRole("button", { name: "Reactivate Learn pottery" });

    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Reactivating…");
    finishRequest({ ok: true });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it.each([
    ["item", "item-1", "Learn pottery"],
    ["project", "project-1", "Build a kiln"],
  ] as const)("keeps a failed %s row available and announces the error", async (type, id, label) => {
    const user = userEvent.setup();
    mockState.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Transition failed." }),
    });
    render(<SomedayActions id={id} label={label} type={type} />);

    await user.click(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Transition failed.");
    expect(screen.getByRole("button")).toBeEnabled();
    expect(mockState.refresh).not.toHaveBeenCalled();
  });

  it("announces a network failure and leaves the action available to retry", async () => {
    const user = userEvent.setup();
    mockState.fetch.mockRejectedValue(new Error("offline"));
    render(<SomedayActions id="item-1" label="Learn pottery" type="item" />);

    const button = screen.getByRole("button", { name: "Reactivate Learn pottery" });
    await user.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(button).toBeEnabled();
    expect(mockState.refresh).not.toHaveBeenCalled();
  });
});