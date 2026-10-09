import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FocusLoading from "./loading";
import FocusPage from "./page";

const profileSingle = vi.fn();
const areasOrder = vi.fn();
const goalsIn = vi.fn();
const projectsIn = vi.fn();
const projectIs = vi.fn();
const { mockFetch, mockRefresh } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "focus_profiles") {
        return { select: () => ({ maybeSingle: profileSingle }) };
      }
      if (table === "areas_of_focus") {
        return { select: () => ({ order: areasOrder }) };
      }
      if (table === "goals") {
        return { select: () => ({ in: (column: string, ids: string[]) => goalsIn(column, ids) }) };
      }
      return {
        select: () => ({
          is: (column: string, value: null) => {
            projectIs(column, value);
            return { in: (areaColumn: string, ids: string[]) => projectsIn(areaColumn, ids) };
          },
        }),
      };
    },
  }),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const AREAS = [
  { id: "area-active", name: "Health", description: "Wellbeing", sort_order: 0, archived_at: null },
  { id: "area-archived", name: "Old responsibility", description: null, sort_order: 1, archived_at: "2026-10-01T00:00:00Z" },
];

async function renderPage() {
  return render(await FocusPage());
}

describe("FocusPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
    profileSingle.mockResolvedValue({ data: null, error: null });
    areasOrder.mockResolvedValue({ data: [], error: null });
    goalsIn.mockResolvedValue({ data: [], error: null });
    projectsIn.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders profile fields for first-time setup and the empty Area state", async () => {
    await renderPage();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("Focus");
    expect(screen.getByRole("heading", { name: "Focus" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "This page is for alignment with God, purpose, and long-term direction — not pressure.",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "I do not need to solve my whole life here. I only need to reconnect with direction and choose the next faithful step.",
    );
    expect(screen.getByLabelText("Vision")).toBeInTheDocument();
    expect(screen.getByLabelText("Purpose")).toBeInTheDocument();
    expect(screen.getByLabelText("Principles")).toBeInTheDocument();
    const profile = screen.getByRole("region", { name: "Purpose, Vision & Principles" });
    const fields = within(profile).getAllByRole("textbox");
    expect(fields[0]).toBe(within(profile).getByLabelText("Purpose"));
    expect(fields[1]).toBe(within(profile).getByLabelText("Vision"));
    expect(fields[2]).toBe(within(profile).getByLabelText("Principles"));
    expect(screen.getByText("No Areas yet.")).toBeInTheDocument();
    expect(goalsIn).not.toHaveBeenCalled();
    expect(projectsIn).not.toHaveBeenCalled();
  });

  it("shows linked Goals and direct standalone Projects with status and detail links", async () => {
    profileSingle.mockResolvedValue({
      data: { vision: "A meaningful life", purpose: "Contribute", principles: ["Be kind"] },
      error: null,
    });
    areasOrder.mockResolvedValue({ data: [AREAS[0]], error: null });
    goalsIn.mockResolvedValue({
      data: [{ id: "goal-1", area_id: "area-active", goal_text: "Run a marathon", status: "active" }],
      error: null,
    });
    projectsIn.mockResolvedValue({
      data: [{ id: "project-1", area_id: "area-active", name: "Weekly training", status: "paused", goal_id: null }],
      error: null,
    });

    await renderPage();
    expect(screen.queryByLabelText("Vision")).not.toBeInTheDocument();
    const profile = screen.getByRole("region", { name: "Purpose, Vision & Principles" });
    expect(within(profile).getByText("Contribute")).toBeInTheDocument();
    expect(within(profile).getByText("A meaningful life")).toBeInTheDocument();
    expect(within(profile).getByText("Be kind")).toBeInTheDocument();
    expect(within(profile).getByRole("button", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Run a marathon/ })).toHaveAttribute(
      "href",
      "/app/goals/goal-1",
    );
    expect(screen.getByRole("link", { name: /Weekly training/ })).toHaveAttribute(
      "href",
      "/app/projects/project-1",
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(projectIs).toHaveBeenCalledWith("goal_id", null);
    expect(projectsIn).toHaveBeenCalledWith("area_id", ["area-active"]);
  });

  it("sorts linked Goals and standalone Projects by name", async () => {
    areasOrder.mockResolvedValue({ data: [AREAS[0]], error: null });
    goalsIn.mockResolvedValue({
      data: [
        { id: "goal-z", area_id: "area-active", goal_text: "Zeta goal", status: "active" },
        { id: "goal-a", area_id: "area-active", goal_text: "Alpha goal", status: "active" },
      ],
      error: null,
    });
    projectsIn.mockResolvedValue({
      data: [
        { id: "project-z", area_id: "area-active", name: "Zeta project", status: "paused", goal_id: null },
        { id: "project-a", area_id: "area-active", name: "Alpha project", status: "paused", goal_id: null },
      ],
      error: null,
    });

    await renderPage();
    const links = within(screen.getByRole("article")).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Alpha goalActive",
      "Zeta goalActive",
      "Alpha projectPaused",
      "Zeta projectPaused",
    ]);
  });

  it("submits a validated profile and announces a successful save", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Purpose"), {
      target: { value: "A useful purpose" },
    });
    fireEvent.change(screen.getByLabelText("Vision"), {
      target: { value: "A useful vision" },
    });
    fireEvent.change(screen.getByLabelText("Principles"), {
      target: { value: "Be kind\nBe curious" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/focus/profile",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            vision: "A useful vision",
            purpose: "A useful purpose",
            principles: ["Be kind", "Be curious"],
          }),
        }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved.");
    expect(mockRefresh).toHaveBeenCalled();
    expect(screen.queryByLabelText("Purpose")).not.toBeInTheDocument();
    const profile = screen.getByRole("region", { name: "Purpose, Vision & Principles" });
    expect(within(profile).getByText("A useful purpose")).toBeInTheDocument();
    expect(within(profile).getByText("A useful vision")).toBeInTheDocument();
    expect(within(profile).getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "Purpose, Vision & Principles",
      "Principles",
    ]);

    fireEvent.click(within(profile).getByRole("button", { name: "Edit profile" }));
    const fields = within(profile).getAllByRole("textbox");
    expect(fields[0]).toBe(within(profile).getByLabelText("Purpose"));
    expect(fields[1]).toBe(within(profile).getByLabelText("Vision"));
    expect(fields[2]).toBe(within(profile).getByLabelText("Principles"));
  });

  it("rejects profile values that exceed server limits before sending", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Principles"), {
      target: { value: Array.from({ length: 51 }, () => "Principle").join("\n") },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("up to 50 principles");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("submits Area create, edit, archive, and restore actions", async () => {
    areasOrder.mockResolvedValue({ data: AREAS, error: null });
    await renderPage();

    const createForm = screen.getByRole("button", { name: "Add Area" }).closest("form")!;
    fireEvent.change(within(createForm).getByLabelText("New Area"), {
      target: { value: "Family" },
    });
    fireEvent.change(within(createForm).getByLabelText("Description"), {
      target: { value: "Make time for family" },
    });
    fireEvent.submit(createForm);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "/api/areas",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Family", description: "Make time for family" }),
      }),
    );

    const activeCard = screen.getAllByLabelText("Area name")[0].closest("article")!;
    fireEvent.change(within(activeCard).getByLabelText("Area name"), {
      target: { value: "Health and energy" },
    });
    fireEvent.click(within(activeCard).getByRole("button", { name: "Save Area" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/areas/area-active",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Health and energy", description: "Wellbeing" }),
      }),
    );

    fireEvent.click(within(activeCard).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      "/api/areas/area-active",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "archive" }) }),
    );

    const archived = screen.getByRole("region", { name: "Archived Areas" });
    fireEvent.click(within(archived).getByRole("button", { name: "Restore Old responsibility" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));
    expect(mockFetch).toHaveBeenNthCalledWith(
      4,
      "/api/areas/area-archived",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "restore" }) }),
    );
  });

  it("submits a complete ordered list when an Area is moved", async () => {
    areasOrder.mockResolvedValue({
      data: [AREAS[0], { ...AREAS[0], id: "area-active-2", name: "Work" }],
      error: null,
    });
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Move Health down" }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/areas/reorder",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ orderedIds: ["area-active-2", "area-active"] }),
        }),
      ),
    );
  });

  it("separates archived Areas and retains their linked records", async () => {
    areasOrder.mockResolvedValue({ data: AREAS, error: null });
    goalsIn.mockResolvedValue({
      data: [{ id: "goal-archived", area_id: "area-archived", goal_text: "Close old goal", status: "completed" }],
      error: null,
    });
    projectsIn.mockResolvedValue({ data: [], error: null });

    await renderPage();
    const archived = screen.getByRole("region", { name: "Archived Areas" });
    expect(
      (within(archived).getByLabelText("Area name") as HTMLInputElement).value,
    ).toBe("Old responsibility");
    expect(within(archived).getByRole("button", { name: "Restore Old responsibility" })).toBeInTheDocument();
    expect(within(archived).getByRole("link", { name: /Close old goal/ })).toHaveAttribute(
      "href",
      "/app/goals/goal-archived",
    );
    expect(goalsIn).toHaveBeenCalledWith("area_id", ["area-active", "area-archived"]);
  });

  it("renders the established retry state when any linked read fails", async () => {
    areasOrder.mockResolvedValue({ data: [AREAS[0]], error: null });
    goalsIn.mockResolvedValue({ data: null, error: { message: "offline" } });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong loading this view. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders the retry state when the profile read fails", async () => {
    profileSingle.mockResolvedValue({ data: null, error: { message: "offline" } });
    await renderPage();
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).querySelector('[aria-current="page"]')).toHaveTextContent("Focus");
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong loading this view.");
  });

  it("renders the retry state when the Area read fails", async () => {
    areasOrder.mockResolvedValue({ data: null, error: { message: "offline" } });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong loading this view.");
  });

  it("renders the Focus loading fallback", () => {
    render(<FocusLoading />);
    expect(screen.getByRole("status", { name: "Loading Focus" })).toBeInTheDocument();
  });
});