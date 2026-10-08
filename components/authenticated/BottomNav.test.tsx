import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";

// usePathname drives the active-state logic; mock it per test.
const mockUsePathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("BottomNav", () => {
  it("retains all destinations, including Someday, in the desktop sidebar", () => {
    mockUsePathname.mockReturnValue("/app/inbox");
    render(<Sidebar />);

    const sidebar = screen.getByTestId("app-sidebar");
    const links = within(sidebar).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toContain("/app/someday");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      expect.arrayContaining([
        "/app/inbox",
        "/app/goals",
        "/app/focus",
        "/app/projects",
        "/app/engage",
        "/app/review",
        "/app/someday",
      ]),
    );
  });

  it("keeps Inbox, Goals, and Engage directly visible with a More control", () => {
    mockUsePathname.mockReturnValue("/app/engage");
    render(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const labels = Array.from(nav.querySelectorAll(":scope > a"))
      .map((link) => link.textContent?.trim());

    expect(labels).toEqual(["Inbox", "Goals", "Engage"]);
    expect(within(nav).getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("link", { name: "Someday" })).not.toBeInTheDocument();
  });

  it("groups Focus, Projects, Weekly Review, and Someday under More", async () => {
    mockUsePathname.mockReturnValue("/app/engage");
    render(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    await userEvent.setup().click(within(nav).getByRole("button", { name: "More" }));

    const links = within(screen.getByRole("list", { hidden: false })).getAllByRole("link");
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "Focus",
      "Projects",
      "Weekly Review",
      "Someday",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/app/focus",
      "/app/projects",
      "/app/review",
      "/app/someday",
    ]);
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

  it("marks Focus active on its route and nested pages", () => {
    mockUsePathname.mockReturnValue("/app/focus");
    const { rerender } = render(<BottomNav />);
    const moreButton = screen.getByRole("button", { name: "More" });

    expect(moreButton).toHaveAttribute("aria-current", "page");
    expect(moreButton).toHaveClass("bg-primary-subtle");
    mockUsePathname.mockReturnValue("/app/focus/area-1");
    rerender(<BottomNav />);
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("closes More after selecting a secondary destination", async () => {
    mockUsePathname.mockReturnValue("/app/inbox");
    const user = userEvent.setup();
    render(<BottomNav />);
    const moreButton = screen.getByRole("button", { name: "More" });
    await user.click(moreButton);
    expect(moreButton).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("link", { name: "Someday" }));

    expect(moreButton).toHaveAttribute("aria-expanded", "false");
  });

  it("marks only the active destination as current while More is open", async () => {
    mockUsePathname.mockReturnValue("/app/someday");
    const user = userEvent.setup();
    render(<BottomNav />);
    const moreButton = screen.getByRole("button", { name: "More" });

    expect(moreButton).toHaveAttribute("aria-current", "page");
    await user.click(moreButton);

    expect(moreButton).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Someday" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("closes More on Escape and restores focus to its button", async () => {
    mockUsePathname.mockReturnValue("/app/inbox");
    const user = userEvent.setup();
    render(<BottomNav />);
    const moreButton = screen.getByRole("button", { name: "More" });
    await user.click(moreButton);
    await user.tab();

    expect(screen.getByRole("link", { name: "Focus" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(moreButton).toHaveAttribute("aria-expanded", "false");
    expect(moreButton).toHaveFocus();
  });

  it("closes More when navigating from the primary links", async () => {
    mockUsePathname.mockReturnValue("/app/inbox");
    const user = userEvent.setup();
    render(<BottomNav />);
    const moreButton = screen.getByRole("button", { name: "More" });
    await user.click(moreButton);
    await user.click(screen.getByRole("link", { name: "Inbox" }));

    expect(moreButton).toHaveAttribute("aria-expanded", "false");
  });
});
