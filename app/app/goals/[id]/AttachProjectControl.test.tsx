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
  {
    id: "p1",
    name: "Base training",
    status: "paused",
    goal_id: null,
    parent_goal_text: null,
  },
  {
    id: "p2",
    name: "Write issue #1",
    status: "active",
    goal_id: "goal-2",
    parent_goal_text: "Improve the product",
  },
  {
    id: "p3",
    name: "Already here",
    status: "active",
    goal_id: "goal-1",
    parent_goal_text: "Current goal",
  },
  {
    id: "p4",
    name: "Archived work",
    status: "archived",
    goal_id: null,
    parent_goal_text: null,
  },
  {
    id: "p5",
    name: "Completed work",
    status: "completed",
    goal_id: null,
    parent_goal_text: null,
  },
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

  it("lists only eligible projects not already linked to this goal", async () => {
    render(<AttachProjectControl goalId={goalId} projects={projects} />);

    const picker = screen.getByRole("combobox", { name: "Attach existing project" });
    expect(picker).toBeEnabled();
    await userEvent.setup().click(picker);
    expect(screen.getByRole("option", { name: /Base training/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Write issue #1/ })).toHaveTextContent(
      "Improve the product",
    );
    expect(screen.queryByRole("option", { name: /Already here/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Archived work/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Completed work/ })).not.toBeInTheDocument();
  });

  it("attaches a goal-less project immediately and refreshes", async () => {
    mockFetch(true);
    const user = userEvent.setup();
    render(<AttachProjectControl goalId={goalId} projects={projects} />);

    await user.type(screen.getByRole("combobox", { name: "Attach existing project" }), "base");
    await user.click(screen.getByRole("option", { name: /Base training/ }));

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

    const picker = screen.getByRole("combobox", { name: "Attach existing project" });
    await user.type(picker, "write");
    expect(screen.getByRole("option", { name: /Write issue #1/ })).toHaveTextContent(
      "Improve the product",
    );
    await user.click(screen.getByRole("option", { name: /Write issue #1/ }));

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

    await user.type(screen.getByRole("combobox", { name: "Attach existing project" }), "write");
    await user.click(screen.getByRole("option", { name: /Write issue #1/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disables the select and offers 'No projects available' when every project is already linked", async () => {
    render(
      <AttachProjectControl
        goalId="goal-1"
        projects={[{
          id: "p3",
          name: "Already here",
          status: "active",
          goal_id: "goal-1",
          parent_goal_text: "Current goal",
        }]}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Attach existing project" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("No projects available");
  });

  it("surfaces an error when the attach fails", async () => {
    mockFetch(false, { error: "Goal not found." }, 404);
    const user = userEvent.setup();
    render(<AttachProjectControl goalId={goalId} projects={projects} />);

    await user.type(screen.getByRole("combobox", { name: "Attach existing project" }), "base");
    await user.click(screen.getByRole("option", { name: /Base training/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Goal not found.");
    expect(refresh).not.toHaveBeenCalled();
  });
});
