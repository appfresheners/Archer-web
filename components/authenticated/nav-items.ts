import type { ReactNode } from "react";
import { createElement } from "react";

/**
 * Shared navigation definition for the authenticated app shell.
 *
 * A single source of truth so `Sidebar` and `BottomNav` can never disagree
 * about the destinations, their order, or their labels. Icons are minimal
 * inline SVGs (no icon library) so the shell has no external UI dependency.
 *
 * Order note: the primary nav follows the GTD workflow, with Focus alongside
 * the core destinations. The bottom-nav label for the
 * review surface is shortened to "Review" to fit small viewports, but both
 * point at the same `/app/review` href from this shared list.
 */

export interface NavItem {
  /** Full label used by the sidebar. */
  label: string;
  /** Short label used by the bottom nav on small viewports. */
  shortLabel: string;
  /** Route the item links to. */
  href: string;
  /** Whether the destination is directly visible in the mobile bar or grouped under More. */
  mobileGroup: "primary" | "more";
  /** Inline SVG icon element. */
  icon: ReactNode;
}

/** Common props shared by every inline nav icon. */
const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** Inbox — a tray glyph. */
function InboxIcon(): ReactNode {
  return createElement(
    "svg",
    iconProps,
    createElement("path", {
      key: "tray",
      d: "M22 12h-6l-2 3h-4l-2-3H2",
    }),
    createElement("path", {
      key: "body",
      d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
    }),
  );
}

/** Goals — a target glyph. */
function GoalsIcon(): ReactNode {
  return createElement(
    "svg",
    iconProps,
    createElement("circle", { key: "c1", cx: 12, cy: 12, r: 10 }),
    createElement("circle", { key: "c2", cx: 12, cy: 12, r: 6 }),
    createElement("circle", { key: "c3", cx: 12, cy: 12, r: 2 }),
  );
}

/** Focus — an eye glyph for higher-horizon context. */
function FocusIcon(): ReactNode {
  return createElement(
    "svg",
    iconProps,
    createElement("path", {
      key: "eye",
      d: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z",
    }),
    createElement("circle", { key: "pupil", cx: 12, cy: 12, r: 3 }),
  );
}

/** Projects — a checked-list glyph. */
function ProjectsIcon(): ReactNode {
  return createElement(
    "svg",
    iconProps,
    createElement("path", { key: "list", d: "M9 6h11M9 12h11M9 18h11" }),
    createElement("path", { key: "checks", d: "m3 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2" }),
  );
}

/** Engage — a lightning bolt (act now). */
function EngageIcon(): ReactNode {
  return createElement(
    "svg",
    iconProps,
    createElement("path", {
      key: "bolt",
      d: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
    }),
  );
}

/** Weekly Review — a calendar-check glyph. */
function ReviewIcon(): ReactNode {
  return createElement(
    "svg",
    iconProps,
    createElement("rect", {
      key: "frame",
      x: 3,
      y: 4,
      width: 18,
      height: 18,
      rx: 2,
    }),
    createElement("path", { key: "m1", d: "M16 2v4" }),
    createElement("path", { key: "m2", d: "M8 2v4" }),
    createElement("path", { key: "m3", d: "M3 10h18" }),
    createElement("path", { key: "check", d: "m9 16 2 2 4-4" }),
  );
}

/** Someday — a bookmark for parked work. */
function SomedayIcon(): ReactNode {
  return createElement(
    "svg",
    iconProps,
    createElement("path", {
      key: "bookmark",
      d: "M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4V4z",
    }),
  );
}

/**
 * Desktop navigation, in workflow order. The mobile bar groups secondary
 * destinations under More to keep its frequent actions easy to reach.
 */
export const navItems: NavItem[] = [
  {
    label: "Inbox",
    shortLabel: "Inbox",
    href: "/app/inbox",
    mobileGroup: "primary",
    icon: InboxIcon(),
  },
  {
    label: "Goals",
    shortLabel: "Goals",
    href: "/app/goals",
    mobileGroup: "primary",
    icon: GoalsIcon(),
  },
  {
    label: "Focus",
    shortLabel: "Focus",
    href: "/app/focus",
    mobileGroup: "more",
    icon: FocusIcon(),
  },
  {
    label: "Projects",
    shortLabel: "Projects",
    href: "/app/projects",
    mobileGroup: "more",
    icon: ProjectsIcon(),
  },
  {
    label: "Engage",
    shortLabel: "Engage",
    href: "/app/engage",
    mobileGroup: "primary",
    icon: EngageIcon(),
  },
  {
    label: "Weekly Review",
    shortLabel: "Review",
    href: "/app/review",
    mobileGroup: "more",
    icon: ReviewIcon(),
  },
  {
    label: "Someday",
    shortLabel: "Someday",
    href: "/app/someday",
    mobileGroup: "more",
    icon: SomedayIcon(),
  },
];
