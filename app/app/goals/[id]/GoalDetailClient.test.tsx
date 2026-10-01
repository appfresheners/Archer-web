import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoalDetailClient from "./GoalDetailClient";
import type { LoadedGoal } from "./page";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const goal: LoadedGoal = {
  id: "g1",
  goal_text: "Run a marathon",
  why: "I want to build confidence and endurance.",
  status: "active",
  target_date: "2026-12-31",
  last_checked_at: null,
  skill_framework: [
    { name: "Pacing", required_level: 8, user_rating: 4, description: "" },
  ],
  drivers: ["health"],
  barriers: ["time"],
  if_then_plan: "If tired, then rest.",
};

function mockFetchOnce(ok: boolean, body: unknown = { id: "g1" }, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("GoalDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCHes a status change and refreshes", async () => {
    mockFetchOnce(true);
    const user = userEvent.setup();
    render(<GoalDetailClient goal={goal} />);

    await user.selectOptions(screen.getByLabelText("Goal status"), "paused");

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("/api/goals/g1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "paused" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("PATCHes edited fields including framework ratings on save", async () => {
    mockFetchOnce(true);
    const user = userEvent.setup();
    render(<GoalDetailClient goal={goal} />);

    await user.click(screen.getByRole("button", { name: "Edit goal" }));
    // Change the framework rating (satisfies AC "edit framework ratings").
    const rating = screen.getByLabelText(/Pacing/);
    await user.clear(rating);
    await user.type(rating, "7");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const init = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const sent = JSON.parse(init.body);
    expect(init.method).toBe("PATCH");
    expect(sent.goal_text).toBe("Run a marathon");
    expect(sent.why).toBe("I want to build confidence and endurance.");
    expect(sent.drivers).toEqual(["health"]);
    expect(sent.skill_framework[0].user_rating).toBe(7);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("confirms and DELETEs, then navigates to the goals list", async () => {
    mockFetchOnce(true);
    const user = userEvent.setup();
    render(<GoalDetailClient goal={goal} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete goal" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("/api/goals/g1");
    expect(init.method).toBe("DELETE");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/goals"));
  });

  it("dismisses the delete dialog on Cancel without calling the API", async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    render(<GoalDetailClient goal={goal} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces an error when a mutation fails", async () => {
    mockFetchOnce(false, { error: "Failed to update the goal." }, 500);
    const user = userEvent.setup();
    render(<GoalDetailClient goal={goal} />);

    await user.selectOptions(screen.getByLabelText("Goal status"), "paused");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to update the goal.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
