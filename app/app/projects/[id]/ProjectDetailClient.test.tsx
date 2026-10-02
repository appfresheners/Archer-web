import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetailClient, {
  type ProjectHeaderData,
} from "./ProjectDetailClient";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const project: ProjectHeaderData = {
  id: "p1",
  name: "Base training",
  purpose: "Build mileage",
  successful_outcome: "Run 20 miles",
  status: "active",
  goalId: "goal-1",
};

const goals = [
  { id: "goal-1", goal_text: "Run a marathon" },
  { id: "goal-2", goal_text: "Launch a newsletter" },
];

function mockFetch(ok: boolean, body: unknown = { id: "p1" }, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("ProjectDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCHes a status change and refreshes", async () => {
    mockFetch(true);
    const user = userEvent.setup();
    render(<ProjectDetailClient project={project} />);

    await user.selectOptions(screen.getByLabelText("Project status"), "completed");

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/projects/p1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "completed" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("PATCHes a parent-goal change and refreshes", async () => {
    mockFetch(true);
    const user = userEvent.setup();
    render(<ProjectDetailClient project={project} goals={goals} />);

    await user.selectOptions(screen.getByLabelText("Parent goal"), "goal-2");

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/projects/p1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ goal_id: "goal-2" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("PATCHes goal_id null when No goal is selected", async () => {
    mockFetch(true);
    const user = userEvent.setup();
    render(<ProjectDetailClient project={project} goals={goals} />);

    await user.selectOptions(screen.getByLabelText("Parent goal"), "");

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const sent = JSON.parse(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(sent).toEqual({ goal_id: null });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("surfaces an error when a parent-goal change fails", async () => {
    mockFetch(false, { error: "Goal not found." }, 404);
    const user = userEvent.setup();
    render(<ProjectDetailClient project={project} goals={goals} />);

    await user.selectOptions(screen.getByLabelText("Parent goal"), "goal-2");

    expect(await screen.findByRole("alert")).toHaveTextContent("Goal not found.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("PATCHes edited fields on save", async () => {
    mockFetch(true);
    const user = userEvent.setup();
    render(<ProjectDetailClient project={project} />);

    await user.click(screen.getByRole("button", { name: "Edit project" }));
    const nameInput = screen.getByLabelText("Project name");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed project");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const sent = JSON.parse(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(sent.name).toBe("Renamed project");
    expect(sent.purpose).toBe("Build mileage");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows a confirmation modal before regenerating and POSTs on confirm", async () => {
    mockFetch(true);
    const user = userEvent.setup();
    render(<ProjectDetailClient project={project} />);

    await user.click(screen.getByRole("button", { name: "Regenerate project" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Regenerate" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/projects/p1/regenerate");
    expect(init.method).toBe("POST");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("does not regenerate when the confirmation is cancelled", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<ProjectDetailClient project={project} />);

    await user.click(screen.getByRole("button", { name: "Regenerate project" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces a timeout message on a 504 regeneration", async () => {
    mockFetch(false, {}, 504);
    const user = userEvent.setup();
    render(<ProjectDetailClient project={project} />);

    await user.click(screen.getByRole("button", { name: "Regenerate project" }));
    await user.click(screen.getByRole("button", { name: "Regenerate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/timed out/i);
    expect(refresh).not.toHaveBeenCalled();
  });
});
