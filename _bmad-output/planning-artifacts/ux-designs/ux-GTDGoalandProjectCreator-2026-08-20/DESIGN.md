---
status: draft
created: 2026-08-20
updated: 2026-08-20
sources:
  - brief: ../briefs/brief-GTDGoalandProjectCreator-2026-08-20/brief.md

colors:
  primary: "[ASSUMPTION] #2563EB" # blue-600 — trust, clarity, action
  primary-hover: "#1D4ED8" # blue-700
  secondary: "#10B981" # emerald-500 — success, completion
  secondary-hover: "#059669" # emerald-600
  background: "#FFFFFF" # clean white
  surface: "#F9FAFB" # gray-50 — card/section backgrounds
  border: "#E5E7EB" # gray-200
  text-primary: "#111827" # gray-900
  text-secondary: "#6B7280" # gray-500
  text-muted: "#9CA3AF" # gray-400
  success: "#10B981" # emerald-500 — copy/download confirmation
  focus-ring: "#2563EB40" # primary with 25% opacity

typography:
  font-family: "Inter, system-ui, -apple-system, sans-serif"
  heading-weight: 700
  body-weight: 400
  base-size: "16px"
  scale: "1.25" # major third

rounded:
  sm: "0.375rem" # 6px — inputs, small buttons
  md: "0.5rem" # 8px — cards, panels
  lg: "0.75rem" # 12px — modals, hero elements
  full: "9999px" # pills, toggles

spacing:
  unit: "0.25rem" # 4px base
  page-x: "1rem" # mobile horizontal padding
  page-x-lg: "4rem" # desktop horizontal padding
  section-y: "4rem" # vertical rhythm between major sections

components:
  button:
    primary:
      bg: "{colors.primary}"
      text: "#FFFFFF"
      hover-bg: "{colors.primary-hover}"
      rounded: "{rounded.sm}"
      padding: "0.75rem 1.5rem"
    secondary:
      bg: "transparent"
      text: "{colors.primary}"
      border: "{colors.primary}"
      hover-bg: "{colors.primary}"
      hover-text: "#FFFFFF"
      rounded: "{rounded.sm}"
      padding: "0.75rem 1.5rem"
  input:
    bg: "{colors.background}"
    border: "{colors.border}"
    focus-border: "{colors.primary}"
    focus-ring: "{colors.focus-ring}"
    rounded: "{rounded.sm}"
    padding: "0.75rem 1rem"
    text: "{colors.text-primary}"
    placeholder: "{colors.text-muted}"
  card:
    bg: "{colors.surface}"
    border: "{colors.border}"
    rounded: "{rounded.md}"
    padding: "1.5rem"
  mode-toggle:
    active-bg: "{colors.primary}"
    active-text: "#FFFFFF"
    inactive-bg: "{colors.surface}"
    inactive-text: "{colors.text-secondary}"
    rounded: "{rounded.full}"
---

# Brand & Style

**Archer** — hit your target, take action.

The brand voice is direct, encouraging, and anti-fluff. Archer doesn't motivate; it removes friction. The visual language mirrors this: clean, minimal, high-contrast text, generous whitespace. No decorative elements that don't serve comprehension.

Personality keywords: clear · immediate · confident · practical · generous

[ASSUMPTION] No logo or brand mark specified. Wordmark "Archer" in Inter Bold with a subtle arrow/target accent is assumed.

# Colors

Minimal palette. Blue anchors trust and action; emerald signals success states (copied, downloaded). Neutral grays provide hierarchy without visual noise. Dark-on-light for maximum readability.

[ASSUMPTION] Dark mode not in MVP1 scope. Single light theme.

# Typography

Inter — geometric, highly legible at all sizes, free, system-fallback-friendly. Major-third scale (1.25) gives clear hierarchy without shouting. Headings bold (700), body regular (400).

| Role            | Size     | Weight | Line-height |
| --------------- | -------- | ------ | ----------- |
| Hero heading    | 2.441rem | 700    | 1.2         |
| Section heading | 1.953rem | 700    | 1.3         |
| Subheading      | 1.563rem | 700    | 1.3         |
| Body            | 1rem     | 400    | 1.6         |
| Small / caption | 0.8rem   | 400    | 1.5         |

# Layout & Spacing

Single-column centered layout. Max content width: 640px (prose-optimized). Full-bleed background, constrained content.

- Mobile: 16px horizontal padding
- Desktop: centered with 64px breathing room
- Section rhythm: 64px vertical gaps
- Card internal: 24px padding

# Elevation & Depth

Flat design. No box-shadows on cards — borders provide separation. Exception: toast/snackbar notifications for copy/download confirmation use a subtle shadow (`0 4px 6px -1px rgba(0,0,0,0.1)`).

# Shapes

Soft rounded corners throughout. Inputs and buttons at 6px, cards at 8px, the mode toggle uses pill shape (full radius).

# Components

## Mode Toggle

Pill-shaped segmented control at the top. Two options: "Goal" and "Project". Active state uses primary color fill with white text; inactive uses surface background with muted text.

## Text Input

Single-line input field with generous padding. Placeholder text guides ("e.g., Become a proficient guitarist in 3 months"). Focus state: primary-colored border + soft ring.

## Generate Button

Full-width primary button below input. Label: "Generate" or "Break it down". Disabled state when input is empty.

## Output Panel

Card container holding the generated markdown rendered as formatted text. Monospace-adjacent feel for the template sections (project names, actions) but still Inter for readability.

## Action Bar

Sticky or inline bar at the bottom of output: two buttons — "Copy Markdown" (primary) and "Download .md" (secondary outline). Confirmation state: button text swaps to "Copied ✓" with emerald color for 2 seconds.

## Example Button

Subtle text-link or ghost button: "Try an example". Pre-fills the input with a sample goal/project and auto-generates.

# Do's and Don'ts

**Do:**

- Keep the page feeling like a tool, not a marketing site
- Use whitespace generously — the product IS clarity
- Make the output scannable — GTD structure should be visually obvious
- Show the full output in one scroll when possible

**Don't:**

- Add decorative illustrations or gradients
- Use more than two action colors
- Hide the output behind tabs or accordions
- Add onboarding modals or tooltips — the UI should be self-evident
