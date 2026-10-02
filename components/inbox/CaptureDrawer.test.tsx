import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CaptureDrawer from "./CaptureDrawer";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

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

describe("CaptureDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });

  it("renders nothing when closed", () => {
    render(<CaptureDrawer open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("focuses the input when opened", async () => {
    render(<CaptureDrawer open onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByLabelText("Capture a thought")).toHaveFocus(),
    );
  });

  it("POSTs to /api/inbox and closes on a successful Capture click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CaptureDrawer open onClose={onClose} />);

    await user.type(screen.getByLabelText("Capture a thought"), "A new idea");
    await user.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/inbox");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ raw_text: "A new idea" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
    // Never navigates.
    expect(push).not.toHaveBeenCalled();
  });

  it("saves on Enter", async () => {
    const user = userEvent.setup();
    render(<CaptureDrawer open onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Capture a thought"), "Typed then enter{Enter}");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/inbox");
    expect(init.method).toBe("POST");
  });

  it("shows an inline error and stays open when the request fails", async () => {
    mockFetch(false, { error: "Failed to capture the item. Please try again." }, 500);
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CaptureDrawer open onClose={onClose} />);

    await user.type(screen.getByLabelText("Capture a thought"), "Boom");
    await user.click(screen.getByRole("button", { name: "Capture" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to capture the item. Please try again.",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on Escape without navigating", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CaptureDrawer open onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("resets draft text and error when closed and reopened", async () => {
    // The drawer is always mounted and only toggles `open`, so stale draft
    // text / a stale error must not survive a close→reopen.
    mockFetch(false, { error: "Failed to capture the item. Please try again." }, 500);
    const user = userEvent.setup();
    const { rerender } = render(<CaptureDrawer open onClose={vi.fn()} />);

    const input = screen.getByLabelText("Capture a thought");
    await user.type(input, "Half-written thought");
    await user.click(screen.getByRole("button", { name: "Capture" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    // Close, then reopen.
    rerender(<CaptureDrawer open={false} onClose={vi.fn()} />);
    rerender(<CaptureDrawer open onClose={vi.fn()} />);

    // Fresh: no leftover text, no leftover error banner.
    expect(screen.getByLabelText("Capture a thought")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
