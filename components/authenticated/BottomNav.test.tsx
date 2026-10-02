import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BottomNav from "./BottomNav";

// usePathname drives the active-state logic; mock it per test.
const mockUsePathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("BottomNav", () => {
  it("renders the destinations in order using their short labels", () => {
    mockUsePathname.mockReturnValue("/app/engage");
    render(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    const labels = links.map((link) => link.textContent?.trim());

    // "Weekly Review" collapses to "Review" in the bottom bar.
    expect(labels).toEqual(["Inbox", "Goals", "Projects", "Engage", "Review"]);
  });

  it("links each destination to its /app/* route", () => {
    mockUsePathname.mockReturnValue("/app/engage");
    render(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const byText = (text: string) =>
      within(nav)
        .getAllByRole("link")
        .find((link) => link.textContent?.trim() === text)!;

    expect(byText("Inbox")).toHaveAttribute("href", "/app/inbox");
    expect(byText("Goals")).toHaveAttribute("href", "/app/goals");
    expect(byText("Projects")).toHaveAttribute("href", "/app/projects");
    expect(byText("Engage")).toHaveAttribute("href", "/app/engage");
    expect(byText("Review")).toHaveAttribute("href", "/app/review");
  });

  it("marks the current path with aria-current='page' and active classes", () => {
    mockUsePathname.mockReturnValue("/app/inbox");
    render(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const inbox = within(nav)
      .getAllByRole("link")
      .find((link) => link.textContent?.trim() === "Inbox")!;

    expect(inbox).toHaveAttribute("aria-current", "page");
    expect(inbox.className).toContain("bg-primary-subtle");
    expect(inbox.className).toContain("text-primary");
  });

  it("treats a nested path as active for its parent destination", () => {
    mockUsePathname.mockReturnValue("/app/goals/123");
    render(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const goals = within(nav)
      .getAllByRole("link")
      .find((link) => link.textContent?.trim() === "Goals")!;

    expect(goals).toHaveAttribute("aria-current", "page");
  });

  it("does not mark inactive items with aria-current", () => {
    mockUsePathname.mockReturnValue("/app/inbox");
    render(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const engage = within(nav)
      .getAllByRole("link")
      .find((link) => link.textContent?.trim() === "Engage")!;

    expect(engage).not.toHaveAttribute("aria-current");
  });
});
