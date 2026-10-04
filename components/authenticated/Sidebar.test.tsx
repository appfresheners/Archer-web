import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

// usePathname drives the active-state logic; mock it per test.
const mockUsePathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("Sidebar", () => {
  it("renders the primary nav inside a <nav> with the destinations in order", () => {
    mockUsePathname.mockReturnValue("/app/engage");
    render(<Sidebar />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    const labels = links.map((link) => link.getAttribute("title"));

    expect(labels).toEqual(["Inbox", "Goals", "Focus", "Projects", "Engage", "Weekly Review"]);
  });

  it("links each nav item to its /app/* route", () => {
    mockUsePathname.mockReturnValue("/app/engage");
    render(<Sidebar />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const byTitle = (title: string) =>
      within(nav)
        .getAllByRole("link")
        .find((link) => link.getAttribute("title") === title)!;

    expect(byTitle("Inbox")).toHaveAttribute("href", "/app/inbox");
    expect(byTitle("Goals")).toHaveAttribute("href", "/app/goals");
    expect(byTitle("Focus")).toHaveAttribute("href", "/app/focus");
    expect(byTitle("Projects")).toHaveAttribute("href", "/app/projects");
    expect(byTitle("Engage")).toHaveAttribute("href", "/app/engage");
    expect(byTitle("Weekly Review")).toHaveAttribute("href", "/app/review");
  });

  it("marks the item for the current path with aria-current='page' and active classes", () => {
    mockUsePathname.mockReturnValue("/app/goals");
    render(<Sidebar />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const goals = within(nav)
      .getAllByRole("link")
      .find((link) => link.getAttribute("title") === "Goals")!;

    expect(goals).toHaveAttribute("aria-current", "page");
    expect(goals.className).toContain("bg-primary-subtle");
    expect(goals.className).toContain("text-primary");
  });

  it("does not mark inactive items with aria-current", () => {
    mockUsePathname.mockReturnValue("/app/goals");
    render(<Sidebar />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const engage = within(nav)
      .getAllByRole("link")
      .find((link) => link.getAttribute("title") === "Engage")!;

    expect(engage).not.toHaveAttribute("aria-current");
  });

  it("treats a nested path as active for its parent destination", () => {
    mockUsePathname.mockReturnValue("/app/goals/123");
    render(<Sidebar />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const goals = within(nav)
      .getAllByRole("link")
      .find((link) => link.getAttribute("title") === "Goals")!;
    expect(goals).toHaveAttribute("aria-current", "page");
  });

  it("marks Focus active on its route and nested pages", () => {
    mockUsePathname.mockReturnValue("/app/focus");
    const { rerender } = render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const focusLink = () =>
      within(nav)
        .getAllByRole("link")
        .find((link) => link.getAttribute("title") === "Focus")!;

    expect(focusLink()).toHaveAttribute("aria-current", "page");
    mockUsePathname.mockReturnValue("/app/focus/area-1");
    rerender(<Sidebar />);
    expect(focusLink()).toHaveAttribute("aria-current", "page");
  });

  it("renders a settings/avatar footer link", () => {
    mockUsePathname.mockReturnValue("/app/engage");
    render(<Sidebar />);

    const settings = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("title") === "Settings")!;
    expect(settings).toBeDefined();
    expect(settings).toHaveAttribute("href", "/app/settings");
  });

  it("renders the Archer wordmark linking to Engage", () => {
    mockUsePathname.mockReturnValue("/app/engage");
    render(<Sidebar />);

    const wordmark = screen.getByRole("link", { name: "Archer — go to Engage" });
    expect(wordmark).toHaveAttribute("href", "/app/engage");
  });
});
