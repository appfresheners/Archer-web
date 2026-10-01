import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MonthlyGoalCheckClient from "./MonthlyGoalCheckClient";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const goal = {
  id: "g1",
  goal_text: "Run a marathon",
  status: "active" as const,
};

describe("MonthlyGoalCheckClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("requires a transient relevance answer before completion", async () => {
    render(<MonthlyGoalCheckClient goal={goal} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete monthly check" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose whether this goal is still relevant before completing the check.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps reflection prompts transient and completes without sending answers", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ id: "g1" }) } as Response);
    render(<MonthlyGoalCheckClient goal={goal} />);

    fireEvent.click(screen.getByLabelText("Yes, it is still relevant"));
    fireEvent.click(screen.getByLabelText("Yes", { selector: "input[name='missing-project']" }));
    fireEvent.click(screen.getByLabelText("Yes", { selector: "input[name='goal-overloaded']" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete monthly check" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/goals/g1/monthly-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relevance: "yes" }),
    });
    expect(push).toHaveBeenCalledWith("/app/goals/g1");
    expect(refresh).toHaveBeenCalled();
  });

  it("updates status through the existing goal PATCH and preserves it on error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Status update failed." }),
    } as Response);
    render(<MonthlyGoalCheckClient goal={goal} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Goal status" }), {
      target: { value: "paused" },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Status update failed.");
    expect(fetch).toHaveBeenCalledWith("/api/goals/g1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    expect(screen.getByRole("combobox", { name: "Goal status" })).toHaveValue("active");
  });

  it("offers all six valid statuses and refreshes after a successful status change", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ id: "g1" }) } as Response);
    render(<MonthlyGoalCheckClient goal={goal} />);
    const statusSelect = screen.getByRole("combobox", { name: "Goal status" });

    expect(statusSelect.querySelectorAll("option")).toHaveLength(6);
    fireEvent.change(statusSelect, { target: { value: "paused" } });

    await waitFor(() => expect(statusSelect).toHaveValue("paused"));
    expect(refresh).toHaveBeenCalled();
  });
});