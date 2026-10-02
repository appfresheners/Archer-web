import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FloatingCapture from "./FloatingCapture";

// The rewired FloatingCapture renders CaptureDrawer, which uses useRouter.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

beforeEach(() => {
  // Keep fetch from being called if a test ever submits the drawer.
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: "x" }),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("FloatingCapture", () => {
  it("renders a button with an accessible label mentioning the C shortcut", () => {
    render(<FloatingCapture />);
    const button = screen.getByRole("button", { name: /capture/i });
    expect(button).toBeInTheDocument();
    expect(button.getAttribute("aria-label")).toMatch(/c/i);
  });

  it("fires the C shortcut (preventDefault) on a bare C keydown outside a text field", () => {
    render(<FloatingCapture />);
    const event = new KeyboardEvent("keydown", { key: "c", cancelable: true });
    const prevent = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);
    expect(prevent).toHaveBeenCalled();
  });

  it("ignores the C shortcut while an input is focused", () => {
    render(
      <>
        <input data-testid="field" />
        <FloatingCapture />
      </>,
    );
    const field = screen.getByTestId("field") as HTMLInputElement;
    field.focus();

    const event = new KeyboardEvent("keydown", { key: "c", cancelable: true, bubbles: true });
    const prevent = vi.spyOn(event, "preventDefault");
    field.dispatchEvent(event);

    // Shortcut suppressed while typing → no preventDefault, key types normally.
    expect(prevent).not.toHaveBeenCalled();
  });

  it("ignores the C shortcut while a textarea is focused", () => {
    render(
      <>
        <textarea data-testid="area" />
        <FloatingCapture />
      </>,
    );
    const area = screen.getByTestId("area") as HTMLTextAreaElement;
    area.focus();

    const event = new KeyboardEvent("keydown", { key: "c", cancelable: true, bubbles: true });
    const prevent = vi.spyOn(event, "preventDefault");
    area.dispatchEvent(event);

    expect(prevent).not.toHaveBeenCalled();
  });

  it("ignores the C shortcut while a contenteditable element is focused", () => {
    render(
      <>
        <div data-testid="editable" contentEditable suppressContentEditableWarning />
        <FloatingCapture />
      </>,
    );
    const editable = screen.getByTestId("editable");
    const event = new KeyboardEvent("keydown", { key: "c", cancelable: true, bubbles: true });
    const prevent = vi.spyOn(event, "preventDefault");
    Object.defineProperty(event, "target", { value: editable });
    document.dispatchEvent(event);

    expect(prevent).not.toHaveBeenCalled();
  });

  it("ignores C when a modifier key is held (e.g. Ctrl+C)", () => {
    render(<FloatingCapture />);
    const event = new KeyboardEvent("keydown", { key: "c", ctrlKey: true, cancelable: true });
    const prevent = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);
    expect(prevent).not.toHaveBeenCalled();
  });

  it("does not fire for other keys", () => {
    render(<FloatingCapture />);
    const event = new KeyboardEvent("keydown", { key: "x", cancelable: true });
    const prevent = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);
    expect(prevent).not.toHaveBeenCalled();
  });

  it("is clickable without throwing", async () => {
    const user = userEvent.setup();
    render(<FloatingCapture />);
    const button = screen.getByRole("button", { name: /capture/i });
    await user.click(button);
    expect(button).toBeInTheDocument();
  });

  it("opens the capture drawer when the FAB is clicked", async () => {
    const user = userEvent.setup();
    render(<FloatingCapture />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("floating-capture"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the capture drawer when the C shortcut fires", () => {
    render(<FloatingCapture />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not re-trigger when C is pressed while the drawer is already open", () => {
    render(<FloatingCapture />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // A second C while open must not open a second dialog or throw.
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
