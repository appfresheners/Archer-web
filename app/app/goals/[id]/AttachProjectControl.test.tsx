import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttachProjectControl, {
  type AttachableProject,
} from "./AttachProjectControl";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const goalId = "goal-1";

const projects: AttachableProject[] = [
  { id: "p1", name: "Base training", goal_id: null },
  { id: "p2", name: "Write issue #1", goal_id: "goal-2" },
  { id: "p3", name: "Already here", goal_id: "goal-1" },
];

function mockFetch(ok: boolean, body: unknown = { id: "p1" }, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("AttachProjectControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only projects not already linked to this goal", async () => {
    render(<AttachProjectControl goalId={goalId} projects={projects} />);

    const select = screen.getByLabelText("Attach existing project");
    expect(screen.getByRole("option", { name: "Base training" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Write issue #1" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Already here" })).not.toBeInTheDocument();
    expect(select).toBeEnabled();
  });

  it("attaches a goal-less project immediately and refreshes", async () => {
    mockFetch(true);
    const user = userEvent.setup();
    render(<AttachProjectControl goalId={goalId} projects={projects} />);

    await user.selectOptions(
      screen.getByLabelText("Attach existing project"),
      "p1",
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("/api/projects/p1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ goal_id: "goal-1" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("confirms before moving a project linked to another goal", async () => {
    mockFetch(true);
    const user = userEvent.setup();
    render(<AttachProjectControl goalId={goalId} projects={projects} />);

    await user.selectOptions(
      screen.getByLabelText("Attach existing project"),
      "p2",
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Move project" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("/api/projects/p2");
    expect(JSON.parse(init.body)).toEqual({ goal_id: "goal-1" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("cancelling a move performs no write", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<AttachProjectControl goalId={goalId} projects={projects} />);

    await user.selectOptions(
      screen.getByLabelText("Attach existing project"),
      "p2",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disables the select and offers 'No projects available' when every project is already linked", async () => {
    render(
      <AttachProjectControl
        goalId="goal-1"
        projects={[{ id: "p3", name: "Already here", goal_id: "goal-1" }]}
      />,
    );

    const select = screen.getByLabelText("Attach existing project");
    expect(select).toBeDisabled();
    expect(
      screen.getByRole("option", { name: "No projects available" }),
    ).toBeInTheDocument();
  });

  it("surfaces an error when the attach fails", async () => {
    mockFetch(false, { error: "Goal not found." }, 404);
    const user = userEvent.setup();
    render(<AttachProjectControl goalId={goalId} projects={projects} />);

    await user.selectOptions(
      screen.getByLabelText("Attach existing project"),
      "p1",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Goal not found.");
    expect(refresh).not.toHaveBeenCalled();
  });
});
