import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClarifyWizard, { type ClarifyItem } from "./ClarifyWizard";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const ITEM: ClarifyItem = { id: "item-1", raw_text: "Call the dentist" };

function mockFetchOk() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: "x" }),
  }) as unknown as typeof fetch;
}

function calls() {
  return (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
}
function bodyOf(url: string): Record<string, unknown> | null {
  const c = calls().find((call) => call[0] === url);
  if (!c) return null;
  return JSON.parse((c[1] as RequestInit).body as string);
}

describe("ClarifyWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOk();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens on 'What is it?' then reaches 'Is it actionable?'", async () => {
    const user = userEvent.setup();
    render(<ClarifyWizard item={ITEM} />);
    expect(screen.getByRole("heading", { name: "What is it?" })).toBeInTheDocument();
    expect(screen.getByText("Call the dentist")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    expect(
      screen.getByRole("heading", { name: "Is it actionable?" }),
    ).toBeInTheDocument();
  });

  // Non-actionable terminal statuses: Trash / Someday / Reference.
  it.each([
    ["Trash", "trashed"],
    ["Someday / Maybe", "someday"],
    ["Reference", "reference"],
  ])("non-actionable → %s PATCHes status=%s and navigates", async (label, status) => {
    const user = userEvent.setup();
    render(<ClarifyWizard item={ITEM} />);

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /not actionable/i }));
    await user.click(screen.getByRole("button", { name: label }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/inbox"));
    const body = bodyOf("/api/inbox/item-1");
    expect(body).toMatchObject({ status });
    // No action was created for a non-actionable item.
    expect(calls().some((c) => c[0] === "/api/actions")).toBe(false);
  });

  it("<2 min → 'Do it now' marks processed with NO action created", async () => {
    const user = userEvent.setup();
    render(<ClarifyWizard item={ITEM} />);

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /yes, it's actionable/i }));
    await user.click(screen.getByRole("button", { name: /single action/i }));
    await user.click(screen.getByRole("button", { name: /do it now/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/inbox"));
    expect(bodyOf("/api/inbox/item-1")).toMatchObject({ status: "processed" });
    expect(calls().some((c) => c[0] === "/api/actions")).toBe(false);
  });

  it("next action → POSTs a standalone available action then processes", async () => {
    const user = userEvent.setup();
    render(<ClarifyWizard item={ITEM} />);

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /yes, it's actionable/i }));
    await user.click(screen.getByRole("button", { name: /single action/i }));
    await user.click(screen.getByRole("button", { name: /it takes longer/i }));
    await user.click(screen.getByRole("button", { name: /^next action$/i }));
    await user.click(screen.getByRole("button", { name: /create next action/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/inbox"));
    expect(bodyOf("/api/actions")).toMatchObject({
      text: "Call the dentist",
      status: "available",
      project_id: null,
    });
    expect(bodyOf("/api/inbox/item-1")).toMatchObject({ status: "processed" });
  });

  it("delegate → POSTs a waiting action with delegated_to then processes", async () => {
    const user = userEvent.setup();
    render(<ClarifyWizard item={ITEM} />);

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /yes, it's actionable/i }));
    await user.click(screen.getByRole("button", { name: /single action/i }));
    await user.click(screen.getByRole("button", { name: /it takes longer/i }));
    await user.click(screen.getByRole("button", { name: /delegate/i }));

    // Button disabled until a name is entered.
    const create = screen.getByRole("button", { name: /create waiting action/i });
    expect(create).toBeDisabled();
    await user.type(screen.getByLabelText(/waiting on/i), "Sam");
    await user.click(screen.getByRole("button", { name: /create waiting action/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/inbox"));
    expect(bodyOf("/api/actions")).toMatchObject({
      status: "waiting",
      delegated_to: "Sam",
    });
  });

  it("defer → POSTs a scheduled action with scheduled_for then processes", async () => {
    const user = userEvent.setup();
    render(<ClarifyWizard item={ITEM} />);

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /yes, it's actionable/i }));
    await user.click(screen.getByRole("button", { name: /single action/i }));
    await user.click(screen.getByRole("button", { name: /it takes longer/i }));
    await user.click(screen.getByRole("button", { name: /defer to a date/i }));

    await user.type(screen.getByLabelText(/scheduled date/i), "2026-06-01");
    await user.click(screen.getByRole("button", { name: /schedule action/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/inbox"));
    expect(bodyOf("/api/actions")).toMatchObject({
      status: "available",
      scheduled_for: "2026-06-01",
    });
  });

  it("multistep → routes to the project creator seeded with the item text", async () => {
    const user = userEvent.setup();
    render(<ClarifyWizard item={ITEM} />);

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /yes, it's actionable/i }));
    await user.click(screen.getByRole("button", { name: /it's a project/i }));

    expect(push).toHaveBeenCalledTimes(1);
    const target = push.mock.calls[0][0] as string;
    expect(target).toContain("/app/projects/new?");
    expect(target).toContain("from_inbox=item-1");
    // URLSearchParams encodes spaces as "+"; parse the seed back to compare.
    const seed = new URLSearchParams(target.split("?")[1]).get("seed");
    expect(seed).toBe("Call the dentist");
    // Multistep hands off — no action/inbox mutation happens here.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("assigns the next action to a project when one is chosen", async () => {
    const user = userEvent.setup();
    const pid = "77777777-7777-4777-8777-777777777777";
    render(
      <ClarifyWizard
        item={ITEM}
        projects={[
          {
            id: pid,
            name: "Home repairs",
            status: "paused",
            goal_id: "goal-home",
            parent_goal_text: "Make the house comfortable",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /yes, it's actionable/i }));
    await user.click(screen.getByRole("button", { name: /single action/i }));
    await user.click(screen.getByRole("button", { name: /it takes longer/i }));
    await user.click(screen.getByRole("button", { name: /^next action$/i }));

    const picker = screen.getByRole("combobox", { name: "Project (optional)" });
    await user.type(picker, "home");
    expect(screen.getByRole("option")).toHaveTextContent("Make the house comfortable");
    await user.click(screen.getByRole("option", { name: /Home repairs/ }));
    await user.click(screen.getByRole("button", { name: /create next action/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/inbox"));
    expect(bodyOf("/api/actions")).toMatchObject({ project_id: pid });
  });

  it("clears the prior project when a replacement search is typed", async () => {
    const user = userEvent.setup();
    const pid = "77777777-7777-4777-8777-777777777777";
    render(
      <ClarifyWizard
        item={ITEM}
        projects={[
          {
            id: pid,
            name: "Home repairs",
            status: "paused",
            goal_id: null,
            parent_goal_text: null,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /yes, it's actionable/i }));
    await user.click(screen.getByRole("button", { name: /single action/i }));
    await user.click(screen.getByRole("button", { name: /it takes longer/i }));
    await user.click(screen.getByRole("button", { name: /^next action$/i }));

    const picker = screen.getByRole("combobox", { name: "Project (optional)" });
    await user.type(picker, "home");
    await user.click(screen.getByRole("option", { name: /Home repairs/ }));
    await user.click(picker);
    await user.type(picker, "different");
    await user.click(screen.getByRole("button", { name: /create next action/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/inbox"));
    expect(bodyOf("/api/actions")).toMatchObject({ project_id: null });
  });

  it("clearing a chosen Clarify project keeps the action standalone", async () => {
    const user = userEvent.setup();
    const pid = "77777777-7777-4777-8777-777777777777";
    render(
      <ClarifyWizard
        item={ITEM}
        projects={[
          {
            id: pid,
            name: "Home repairs",
            status: "paused",
            goal_id: null,
            parent_goal_text: null,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /yes, it's actionable/i }));
    await user.click(screen.getByRole("button", { name: /single action/i }));
    await user.click(screen.getByRole("button", { name: /it takes longer/i }));
    await user.click(screen.getByRole("button", { name: /^next action$/i }));

    const picker = screen.getByRole("combobox", { name: "Project (optional)" });
    await user.type(picker, "home");
    await user.click(screen.getByRole("option", { name: /Home repairs/ }));
    await user.click(screen.getByRole("button", { name: "Clear project selection" }));
    await user.click(screen.getByRole("button", { name: /create next action/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/inbox"));
    expect(bodyOf("/api/actions")).toMatchObject({ project_id: null });
  });

  it("surfaces an error and does not navigate when the API fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed to process the item. Please try again." }),
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<ClarifyWizard item={ITEM} />);
    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /not actionable/i }));
    await user.click(screen.getByRole("button", { name: "Trash" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to process/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("does not re-create the action when a retry only needs the inbox PATCH", async () => {
    // Action POST always succeeds; the inbox PATCH fails the first time then
    // succeeds. The retry must NOT create a second action (no orphan/dupe).
    let inboxCalls = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/actions") {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ id: "a1" }) });
      }
      // /api/inbox/item-1 PATCH: fail first, succeed second.
      inboxCalls += 1;
      const ok = inboxCalls > 1;
      return Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        json: async () => (ok ? { id: "item-1" } : { error: "Failed to process the item." }),
      });
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<ClarifyWizard item={ITEM} />);
    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /yes, it's actionable/i }));
    await user.click(screen.getByRole("button", { name: /single action/i }));
    await user.click(screen.getByRole("button", { name: /it takes longer/i }));
    await user.click(screen.getByRole("button", { name: /^next action$/i }));

    // First attempt: action created, inbox PATCH fails → error, no navigate.
    await user.click(screen.getByRole("button", { name: /create next action/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    // Retry: inbox PATCH now succeeds and we navigate.
    await user.click(screen.getByRole("button", { name: /create next action/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/inbox"));

    // The action was POSTed exactly once across both attempts.
    const actionPosts = calls().filter((c) => c[0] === "/api/actions");
    expect(actionPosts).toHaveLength(1);
  });

  it("Back retraces the branch taken", async () => {
    const user = userEvent.setup();
    render(<ClarifyWizard item={ITEM} />);

    await user.click(screen.getByRole("button", { name: /is it actionable/i }));
    await user.click(screen.getByRole("button", { name: /not actionable/i }));
    expect(
      screen.getByRole("heading", { name: /where does it go/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("heading", { name: "Is it actionable?" }),
    ).toBeInTheDocument();
  });
});
