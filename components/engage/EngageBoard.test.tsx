import type { EngageModel } from "@/lib/engage/model";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EngageBoard from "./EngageBoard";

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

/** A model with two goal groups, a stuck project, and an Anytime row. */
function fullModel(): EngageModel {
  return {
    goalGroups: [
      {
        goalId: "g1",
        goalText: "Launch freelance career",
        committed: [
          {
            id: "a1",
            text: "Write the intro",
            energy: null,
            context_tags: ["@location:home"],
            time_available_minutes: 25,
            projectId: "p1",
            projectName: "Portfolio site",
          },
        ],
        stuckProjects: [{ id: "p2", name: "Set up invoicing" }],
        availableByProject: {
          p1: [{ id: "a9", text: "Add the gallery" }],
          p2: [],
        },
      },
      {
        goalId: "g2",
        goalText: "Get fit",
        committed: [
          {
            id: "b1",
            text: "Book a trainer",
            energy: "high",
            context_tags: [],
            time_available_minutes: 25,
            projectId: "p3",
            projectName: "Gym plan",
          },
        ],
        stuckProjects: [],
        availableByProject: { p3: [] },
      },
    ],
    projectGroups: [],
    anytime: [
      {
        id: "s1",
        text: "Call the bank",
        energy: null,
        context_tags: ["@location:home"],
        time_available_minutes: 25,
        projectId: null,
        projectName: null,
      },
    ],
    isEmpty: false,
  };
}

describe("EngageBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });

  it("renders committed rows grouped by goal, with tags, project name + Done", () => {
    render(<EngageBoard model={fullModel()} />);

    expect(screen.getByText("Launch freelance career")).toBeInTheDocument();
    expect(screen.getByText("Get fit")).toBeInTheDocument();
    expect(screen.getByText("Write the intro")).toBeInTheDocument();
    expect(screen.getByText("Portfolio site")).toBeInTheDocument();
    // Tag chip present. Two rows carry @location:home (a1 + Anytime s1).
    expect(screen.getAllByText("@location:home").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByRole("button", { name: /Mark ".*" done/ }).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("renders the Anytime / No project group for standalone rows", () => {
    render(<EngageBoard model={fullModel()} />);
    expect(screen.getByText("Anytime / No project")).toBeInTheDocument();
    expect(screen.getByText("Call the bank")).toBeInTheDocument();
  });

  it("opens the Pomodoro controls from an Engage action", async () => {
    const user = userEvent.setup();
    render(<EngageBoard model={fullModel()} />);

    await user.click(
      screen.getByRole("button", { name: 'Open focus timer for "Write the intro"' }),
    );

    expect(screen.getByRole("region", { name: "Focus timer for Write the intro" })).toBeInTheDocument();
    expect(screen.getByText(/25 minutes available/)).toBeInTheDocument();
  });

  it("renders committed actions grouped under a goal-less project", () => {
    const model: EngageModel = {
      goalGroups: [],
      projectGroups: [
        {
          projectId: "project-mode-1",
          projectName: "Portfolio live",
          committed: [
            {
              id: "project-action-1",
              text: "Publish the portfolio",
              energy: null,
              context_tags: [],
              time_available_minutes: 25,
              projectId: "project-mode-1",
              projectName: "Portfolio live",
            },
          ],
          available: [],
        },
      ],
      anytime: [],
      isEmpty: false,
    };

    render(<EngageBoard model={model} />);

    expect(screen.getAllByText("Portfolio live")).toHaveLength(2);
    expect(screen.getByText("Publish the portfolio")).toBeInTheDocument();
  });

  it("keeps the next-action prompt working for a goal-less project", async () => {
    const user = userEvent.setup();
    const model: EngageModel = {
      goalGroups: [],
      projectGroups: [
        {
          projectId: "project-mode-1",
          projectName: "Portfolio live",
          committed: [
            {
              id: "project-action-1",
              text: "Publish the portfolio",
              energy: null,
              context_tags: [],
              time_available_minutes: 25,
              projectId: "project-mode-1",
              projectName: "Portfolio live",
            },
          ],
          available: [{ id: "project-action-2", text: "Share the URL" }],
        },
      ],
      anytime: [],
      isEmpty: false,
    };

    render(<EngageBoard model={model} />);
    await user.click(
      screen.getByRole("button", { name: 'Mark "Publish the portfolio" done' }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("What's next for Portfolio live?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Share the URL" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(lastCall()[0]).toBe("/api/actions/project-action-2/commit");
  });

  it("shows the amber stuck band at the bottom of a goal group", () => {
    render(<EngageBoard model={fullModel()} />);
    expect(screen.getByText("Set up invoicing")).toBeInTheDocument();
    expect(
      screen.getByText("No committed next action — this project is stuck."),
    ).toBeInTheDocument();
  });

  it("routes to the project detail #actions when 'Commit one now' is clicked", async () => {
    const user = userEvent.setup();
    render(<EngageBoard model={fullModel()} />);
    await user.click(screen.getByRole("button", { name: "Commit one now" }));
    expect(push).toHaveBeenCalledWith("/app/projects/p2#actions");
  });

  it("narrows visible rows with the energy filter", async () => {
    const user = userEvent.setup();
    render(<EngageBoard model={fullModel()} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by energy" }),
      "high",
    );
    expect(screen.getByText("Book a trainer")).toBeInTheDocument();
    expect(screen.queryByText("Write the intro")).not.toBeInTheDocument();
    expect(screen.queryByText("Call the bank")).not.toBeInTheDocument();
  });

  it("clears a stale filter after a refresh removes the filtered tag (no dead-end)", async () => {
    const user = userEvent.setup();
    // Two rows with distinct contexts and energy values.
    const twoTags: EngageModel = {
      goalGroups: [
        {
          goalId: "g1",
          goalText: "Solo",
          committed: [
            {
              id: "a1",
              text: "Tagged A",
              energy: null,
              context_tags: ["@location:office"],
              time_available_minutes: 25,
              projectId: "p1",
              projectName: "P1",
            },
            {
              id: "a2",
              text: "Tagged B",
              energy: "low",
              context_tags: [],
              time_available_minutes: 25,
              projectId: "p1",
              projectName: "P1",
            },
          ],
          stuckProjects: [],
          availableByProject: { p1: [] },
        },
      ],
      projectGroups: [],
      anytime: [],
      isEmpty: false,
    };
    const { rerender } = render(<EngageBoard model={twoTags} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by context" }),
      "@location:office",
    );
    expect(screen.getByText("Tagged A")).toBeInTheDocument();
    expect(screen.queryByText("Tagged B")).not.toBeInTheDocument();

    // Simulate a refresh where the @location:office row is gone.
    const noMatch: EngageModel = {
      goalGroups: [
        {
          goalId: "g1",
          goalText: "Solo",
          committed: [
            {
              id: "a2",
              text: "Tagged B",
              energy: "low",
              context_tags: [],
              time_available_minutes: 25,
              projectId: "p1",
              projectName: "P1",
            },
          ],
          stuckProjects: [],
          availableByProject: { p1: [] },
        },
      ],
      projectGroups: [],
      anytime: [],
      isEmpty: false,
    };
    rerender(<EngageBoard model={noMatch} />);
    // The stale office filter no longer exists in the data, so it clears
    // instead of stranding the user on a no-match view.
    expect(screen.getByText("Tagged B")).toBeInTheDocument();
    expect(
      screen.queryByText("No committed actions match this filter."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filter by context" })).toHaveValue("");
  });

  it("combines context, energy, and maximum time filters", async () => {
    const user = userEvent.setup();
    const model: EngageModel = {
      goalGroups: [
        {
          goalId: "g1",
          goalText: "Focus",
          committed: [
            {
              id: "a1",
              text: "Matching action",
              energy: "high",
              context_tags: ["@location:home"],
              time_available_minutes: 10,
              projectId: "p1",
              projectName: "P1",
            },
            {
              id: "a2",
              text: "Too much time",
              energy: "high",
              context_tags: ["@location:home"],
              time_available_minutes: 25,
              projectId: "p1",
              projectName: "P1",
            },
            {
              id: "a3",
              text: "Wrong context",
              energy: "high",
              context_tags: ["@location:home-office"],
              time_available_minutes: 5,
              projectId: "p1",
              projectName: "P1",
            },
            {
              id: "a4",
              text: "Wrong energy",
              energy: "low",
              context_tags: ["@location:home"],
              time_available_minutes: 5,
              projectId: "p1",
              projectName: "P1",
            },
          ],
          stuckProjects: [],
          availableByProject: { p1: [] },
        },
      ],
      projectGroups: [],
      anytime: [],
      isEmpty: false,
    };

    render(<EngageBoard model={model} />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by context" }),
      "@location:home",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by energy" }),
      "high",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by time available" }),
      "10",
    );

    expect(screen.getByText("Matching action")).toBeInTheDocument();
    expect(screen.queryByText("Too much time")).not.toBeInTheDocument();
    expect(screen.queryByText("Wrong context")).not.toBeInTheDocument();
    expect(screen.queryByText("Wrong energy")).not.toBeInTheDocument();
  });

  it("Done on a project row PATCHes status=done and opens the next-action prompt", async () => {
    const user = userEvent.setup();
    render(<EngageBoard model={fullModel()} />);

    await user.click(screen.getByRole("button", { name: 'Mark "Write the intro" done' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = lastCall();
    expect(url).toBe("/api/actions/a1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "done" });

    expect(
      await screen.findByText("What's next for Portfolio site?"),
    ).toBeInTheDocument();
  });

  it("committing a next action from the prompt POSTs /commit and refreshes", async () => {
    const user = userEvent.setup();
    render(<EngageBoard model={fullModel()} />);

    await user.click(screen.getByRole("button", { name: 'Mark "Write the intro" done' }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Add the gallery" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(lastCall()[0]).toBe("/api/actions/a9/commit");
    expect(lastCall()[1].method).toBe("POST");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("offers 'mark project complete?' when no available actions remain", async () => {
    const user = userEvent.setup();
    render(<EngageBoard model={fullModel()} />);

    // "Book a trainer" (p3) has no remaining available actions.
    await user.click(screen.getByRole("button", { name: 'Mark "Book a trainer" done' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    expect(
      await screen.findByText("No actions remain. Mark this project complete?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark project complete" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const [url, init] = lastCall();
    expect(url).toBe("/api/projects/p3");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "completed" });
  });

  it("Done on a standalone row PATCHes status=done and does NOT prompt", async () => {
    const user = userEvent.setup();
    render(<EngageBoard model={fullModel()} />);

    await user.click(screen.getByRole("button", { name: 'Mark "Call the bank" done' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = lastCall();
    expect(url).toBe("/api/actions/s1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "done" });

    // No project → no prompt; refresh fires instead.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("surfaces an inline error when a mutation fails", async () => {
    mockFetch(false, { error: "Failed to update the action. Please try again." }, 500);
    const user = userEvent.setup();
    render(<EngageBoard model={fullModel()} />);

    await user.click(screen.getByRole("button", { name: 'Mark "Write the intro" done' }));
    expect(
      await screen.findByText("Failed to update the action. Please try again."),
    ).toBeInTheDocument();
  });

  it("renders the honest empty state with no confetti", () => {
    render(
      <EngageBoard
        model={{ goalGroups: [], projectGroups: [], anytime: [], isEmpty: true }}
      />,
    );
    expect(
      screen.getByText("No committed actions. Open a project and commit one."),
    ).toBeInTheDocument();
  });
});
