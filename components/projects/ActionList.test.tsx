import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionItemData } from "./ActionItem";
import ActionList from "./ActionList";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

function actions(): ActionItemData[] {
  return [
    { id: "a1", text: "Draft outline", status: "available", context_tags: ["@energy:high"], sort_order: 0 },
    { id: "a2", text: "Write intro", status: "committed", context_tags: [], sort_order: 1 },
    { id: "a3", text: "Publish", status: "done", context_tags: null, sort_order: 2 },
  ];
}

function mockFetch(ok = true, body: unknown = { id: "x" }, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function lastCall() {
  return (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
}

describe("ActionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });

  it("renders each action with text, tags, and status-driven treatment", () => {
    render(<ActionList projectId="p1" actions={actions()} />);
    expect(screen.getByText("Draft outline")).toBeInTheDocument();
    expect(screen.getByText("@energy:high")).toBeInTheDocument();
    // Done action gets a line-through class and a checked checkbox.
    const publish = screen.getByText("Publish");
    expect(publish.className).toContain("line-through");
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[2]).toBeChecked(); // "Publish" is done
    expect(checkboxes[0]).not.toBeChecked();
  });

  it("adds an action via the inline field", async () => {
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    await user.type(screen.getByLabelText("New action"), "New step");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/projects/p1/actions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ text: "New step" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("toggles completion via the checkbox (available -> done)", async () => {
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    await user.click(screen.getAllByRole("checkbox")[0]); // a1 available -> done
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/actions/a1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "done" });
  });

  it("deletes an action", async () => {
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    await user.click(screen.getAllByRole("button", { name: "Delete action" })[0]);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/actions/a1");
    expect(init.method).toBe("DELETE");
  });

  it("reorders by moving an action down (sends the full ordered id list)", async () => {
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    // Move the first action (a1) down → order becomes a2, a1, a3.
    await user.click(screen.getAllByRole("button", { name: "Move action down" })[0]);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/projects/p1/actions");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ orderedIds: ["a2", "a1", "a3"] });
  });

  it("gives the committed row the primary treatment and leaves its checkbox unchecked", () => {
    render(<ActionList projectId="p1" actions={actions()} />);
    // The committed action ("Write intro") sits in a primary-bordered container.
    const committedItem = screen.getByText("Write intro").closest("li")!;
    expect(committedItem.className).toContain("border-primary");
    expect(committedItem.className).toContain("bg-primary-subtle");
    // Committed is not "done", so its checkbox is unchecked.
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[1]).not.toBeChecked();
    // Available rows use the default border, not the primary one.
    const availableItem = screen.getByText("Draft outline").closest("li")!;
    expect(availableItem.className).toContain("border-border");
  });

  it("edits action text inline and PATCHes {text}", async () => {
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    await user.click(screen.getAllByRole("button", { name: "Edit action" })[0]);
    const input = screen.getByLabelText("Edit action text");
    await user.clear(input);
    await user.type(input, "Draft the full outline{Enter}");

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/actions/a1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ text: "Draft the full outline" });
  });

  it("reorders by moving an action up", async () => {
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    // Move the second action (a2) up → order becomes a2, a1, a3.
    await user.click(screen.getAllByRole("button", { name: "Move action up" })[1]);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(JSON.parse(lastCall()[1].body)).toEqual({
      orderedIds: ["a2", "a1", "a3"],
    });
  });

  it("commits an available action via the dedicated commit route", async () => {
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    // Only available actions expose a Commit control; a1 is available.
    await user.click(screen.getByRole("button", { name: /Commit "Draft outline"/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/actions/a1/commit");
    expect(init.method).toBe("POST");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("prompts for the next committed action after completing a committed one", async () => {
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    // Complete the committed action (a2, "Write intro") via its checkbox.
    await user.click(screen.getAllByRole("checkbox")[1]);

    // The done PATCH fires, then the next-action prompt opens.
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(lastCall()[1].body)).toEqual({ status: "done" });
    expect(
      await screen.findByText("What's next for this project?"),
    ).toBeInTheDocument();
    // The remaining available action (a1) is offered to commit.
    const choice = screen.getByRole("button", { name: "Draft outline" });
    await user.click(choice);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(lastCall()[0]).toBe("/api/actions/a1/commit");
    expect(lastCall()[1].method).toBe("POST");
  });

  it("does not open the next-action prompt when completing a non-committed action", async () => {
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    // a1 is available (not committed) — completing it must not prompt.
    await user.click(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(
      screen.queryByText("What's next for this project?"),
    ).not.toBeInTheDocument();
  });

  it("offers to mark the project complete when no available actions remain", async () => {
    const user = userEvent.setup();
    // Only a committed action + a done one: completing the committed leaves none available.
    const noneRemaining: ActionItemData[] = [
      { id: "c1", text: "The one", status: "committed", context_tags: [], sort_order: 0 },
      { id: "d1", text: "Already done", status: "done", context_tags: [], sort_order: 1 },
    ];
    render(<ActionList projectId="p1" actions={noneRemaining} />);

    await user.click(screen.getAllByRole("checkbox")[0]); // complete committed c1
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    expect(
      await screen.findByText("No actions remain. Mark this project complete?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark project complete" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const [url, init] = lastCall();
    expect(url).toBe("/api/projects/p1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "completed" });
  });

  it("dismisses the next-action prompt on 'Not now' without further mutation", async () => {
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    await user.click(screen.getAllByRole("checkbox")[1]); // complete committed a2
    await screen.findByText("What's next for this project?");
    await user.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Only the initial done PATCH fired — no commit/complete.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("surfaces an error when a mutation fails", async () => {
    mockFetch(false, { error: "Failed to add the action." }, 500);
    const user = userEvent.setup();
    render(<ActionList projectId="p1" actions={actions()} />);

    await user.type(screen.getByLabelText("New action"), "X");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to add the action.",
    );
  });
});
