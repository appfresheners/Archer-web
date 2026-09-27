import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import FloatingCapture from "./FloatingCapture";

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
});
