import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PomodoroTimer from "./PomodoroTimer";

afterEach(() => {
  vi.useRealTimers();
});

describe("PomodoroTimer", () => {
  it("uses the available time up to one 25-minute Pomodoro", () => {
    render(<PomodoroTimer actionText="Write the project brief" />);

    const available = screen.getByRole("spinbutton", {
      name: "Time available (minutes)",
    });
    fireEvent.change(available, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Pomodoro (12 min)" }));

    expect(screen.getByRole("timer")).toHaveTextContent("12:00");
  });

  it("caps longer availability at 25 minutes and counts down", () => {
    vi.useFakeTimers();
    render(<PomodoroTimer actionText="Write the project brief" />);

    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start Pomodoro (25 min)" }));

    expect(screen.getByRole("timer")).toHaveTextContent("25:00");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("24:59");
  });
});