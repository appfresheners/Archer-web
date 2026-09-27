---
status: draft
created: 2026-08-20
updated: 2026-09-27
sources:
  - prd: ../../../prds/prd-GTDGoalandProjectCreator-2026-08-20/prd.md
  - brief: ../briefs/brief-GTDGoalandProjectCreator-2026-08-20/brief.md

colors:
  # Primary actions — trust, clarity, commitment
  primary: "#2563EB" # blue-600
  primary-hover: "#1D4ED8" # blue-700
  primary-subtle: "#EFF6FF" # blue-50 — pill backgrounds, step indicators

  # Success / completion states
  success: "#10B981" # emerald-500
  success-hover: "#059669" # emerald-600
  success-subtle: "#ECFDF5" # emerald-50 — done/copied badges

  # Warning — stuck projects, overdue items
  warning: "#F59E0B" # amber-500
  warning-subtle: "#FFFBEB" # amber-50

  # Destructive — delete, clear vault, archive
  destructive: "#EF4444" # red-500
  destructive-hover: "#DC2626" # red-600
  destructive-subtle: "#FEF2F2" # red-50

  # Neutral surfaces
  background: "#FFFFFF"
  surface: "#F9FAFB" # gray-50 — sidebar, cards, panels
  surface-raised: "#FFFFFF" # modals, drawers over surface
  border: "#E5E7EB" # gray-200
  border-strong: "#D1D5DB" # gray-300 — active input frames

  # Text hierarchy
  text-primary: "#111827" # gray-900
  text-secondary: "#6B7280" # gray-500
  text-muted: "#9CA3AF" # gray-400
  text-inverse: "#FFFFFF"

  # Focus
  focus-ring: "#2563EB40" # primary @ 25% opacity

  # Wizard step states
  step-complete: "#10B981" # emerald-500
  step-active: "#2563EB" # primary
  step-upcoming: "#E5E7EB" # gray-200

  # Status badges (goal/project statuses)
  status-active: "#2563EB"
  status-paused: "#F59E0B"
  status-someday: "#9CA3AF"
  status-completed: "#10B981"
  status-archived: "#6B7280"
  status-not-now: "#EF4444"

typography:
  font-family: "Inter, system-ui, -apple-system, sans-serif"
  font-mono: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
  heading-weight: 700
  subheading-weight: 600
  body-weight: 400
  base-size: "16px"
  scale: "1.25" # major third

rounded:
  xs: "0.25rem" # 4px — badges, chips
  sm: "0.375rem" # 6px — inputs, small buttons
  md: "0.5rem" # 8px — cards, panels
  lg: "0.75rem" # 12px — drawers, modals
  xl: "1rem" # 16px — wizard container
  full: "9999px" # pills, toggles, step indicators

spacing:
  unit: "0.25rem" # 4px base
  page-x: "1rem" # 16px — mobile horizontal padding
  page-x-lg: "1.5rem" # 24px — desktop horizontal padding (sidebar layout)
  section-y: "2rem" # 32px — vertical rhythm between major sections
  card-p: "1.5rem" # 24px — card internal padding
  sidebar-w: "240px" # fixed sidebar width (authenticated layout)
  content-max: "720px" # max prose/form width in main area

components:
  button:
    primary:
      bg: "{colors.primary}"
      text: "{colors.text-inverse}"
      hover-bg: "{colors.primary-hover}"
      rounded: "{rounded.sm}"
      padding: "0.625rem 1.25rem"
      font-weight: 500
    secondary:
      bg: "transparent"
      text: "{colors.primary}"
      border: "{colors.primary}"
      hover-bg: "{colors.primary-subtle}"
      rounded: "{rounded.sm}"
      padding: "0.625rem 1.25rem"
      font-weight: 500
    ghost:
      bg: "transparent"
      text: "{colors.text-secondary}"
      hover-bg: "{colors.surface}"
      rounded: "{rounded.sm}"
      padding: "0.625rem 1.25rem"
    destructive:
      bg: "{colors.destructive}"
      text: "{colors.text-inverse}"
      hover-bg: "{colors.destructive-hover}"
      rounded: "{rounded.sm}"
      padding: "0.625rem 1.25rem"
    icon:
      bg: "transparent"
      text: "{colors.text-secondary}"
      hover-bg: "{colors.surface}"
      rounded: "{rounded.sm}"
      size: "2rem" # 32px
    disabled:
      opacity: "0.4"
      cursor: "not-allowed"

  input:
    bg: "{colors.background}"
    border: "{colors.border}"
    focus-border: "{colors.primary}"
    focus-ring: "{colors.focus-ring}"
    rounded: "{rounded.sm}"
    padding: "0.625rem 0.875rem"
    text: "{colors.text-primary}"
    placeholder: "{colors.text-muted}"
    font-size: "1rem"
    error-border: "{colors.destructive}"

  textarea:
    inherits: input
    min-height: "80px"
    resize: "vertical"

  card:
    bg: "{colors.surface-raised}"
    border: "{colors.border}"
    rounded: "{rounded.md}"
    padding: "{spacing.card-p}"
    shadow: "none"

  sidebar:
    bg: "{colors.surface}"
    border-right: "{colors.border}"
    width: "{spacing.sidebar-w}"
    nav-item-active-bg: "{colors.primary-subtle}"
    nav-item-active-text: "{colors.primary}"
    nav-item-hover-bg: "{colors.surface}"

  mode-toggle:
    bg: "{colors.surface}"
    active-bg: "{colors.primary}"
    active-text: "{colors.text-inverse}"
    inactive-text: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    border: "{colors.border}"
    note: "Used in authenticated views only (e.g. project status tabs). Not used on the unauthenticated landing — Project Mode is the default and only unauthenticated mode."

  wizard-stepper:
    connector-color: "{colors.border}"
    connector-complete-color: "{colors.step-complete}"
    step-size: "2rem" # 32px circle
    complete-bg: "{colors.step-complete}"
    complete-text: "{colors.text-inverse}"
    active-bg: "{colors.step-active}"
    active-text: "{colors.text-inverse}"
    upcoming-bg: "{colors.step-upcoming}"
    upcoming-text: "{colors.text-muted}"

  gap-slider:
    track-bg: "{colors.border}"
    fill-bg: "{colors.primary}"
    thumb-bg: "{colors.primary}"
    thumb-size: "1.25rem"
    height: "0.25rem"

  badge:
    rounded: "{rounded.xs}"
    padding: "0.125rem 0.5rem"
    font-size: "0.75rem"
    font-weight: 500
    active:
      bg: "{colors.status-active}"
      text: "{colors.text-inverse}"
    paused:
      bg: "{colors.warning-subtle}"
      text: "{colors.warning}"
    someday:
      bg: "{colors.surface}"
      text: "{colors.text-muted}"
      border: "{colors.border}"
    completed:
      bg: "{colors.success-subtle}"
      text: "{colors.success}"
    archived:
      bg: "{colors.surface}"
      text: "{colors.text-secondary}"
    not-now:
      bg: "{colors.destructive-subtle}"
      text: "{colors.destructive}"

  progress-bar:
    bg: "{colors.border}"
    fill-bg: "{colors.primary}"
    height: "0.25rem"
    rounded: "{rounded.full}"

  tooltip:
    bg: "{colors.text-primary}"
    text: "{colors.text-inverse}"
    rounded: "{rounded.xs}"
    padding: "0.25rem 0.5rem"
    font-size: "0.75rem"

  modal:
    overlay-bg: "rgba(0,0,0,0.4)"
    bg: "{colors.surface-raised}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
    shadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)"
    max-width: "480px"

  toast:
    bg: "{colors.text-primary}"
    text: "{colors.text-inverse}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
    shadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
    success-accent: "{colors.success}"
    error-accent: "{colors.destructive}"

  action-item:
    bg: "{colors.surface-raised}"
    border: "{colors.border}"
    committed-border: "{colors.primary}"
    committed-bg: "{colors.primary-subtle}"
    done-text: "{colors.text-muted}"
    done-decoration: "line-through"
    rounded: "{rounded.sm}"
    padding: "0.625rem 0.875rem"

  stuck-indicator:
    bg: "{colors.warning-subtle}"
    border: "{colors.warning}"
    text: "{colors.warning}"
    icon: "⚠"

  vault-unlock:
    bg: "{colors.surface}"
    border: "{colors.border}"
    rounded: "{rounded.lg}"
    icon-color: "{colors.text-muted}"
---

# Brand & Style

**Archer** — close the gap. Take the shot.

Archer is a system, not a cheerleader. The brand voice is direct, terse, and anti-fluff. It never motivates — it removes friction. Every word earns its place. The visual language mirrors this: clean, minimal, high-contrast, generous whitespace. Nothing decorates that doesn't serve comprehension.

Personality keywords: **clear · immediate · confident · practical · earned**

Archer's visual register is closer to a professional tool (Linear, Notion) than a consumer wellness app. It does not celebrate, it does not gamify, it does not nag. It surfaces the work, removes the noise, and gets out of the way.

Brand voice examples:

- "Type a goal. Get the next actions." — not "Unlock your potential!"
- "Copied ✓" — not "Great job sharing your plan!"
- "1 stuck project" — not "You have some items to review 👋"
- "Get Clear → Get Current → Get Creative" — the structure speaks; no preamble needed

Logo: Wordmark "Archer" in Inter Bold (700). No mark in MVP — wordmark only. Future: minimal arrow/target glyph.

Dark mode: out of scope for v1.

---

# Colors

Minimal four-role palette:

- **Blue (primary):** trust, action, commitment — all primary CTAs, active states, wizard progress, focus rings
- **Emerald (success):** completion, done states — copied/downloaded confirmation, completed project badges, wizard step-complete indicators
- **Amber (warning):** stuck projects, overdue inbox items — never used for primary actions
- **Red (destructive):** delete, archive, clear vault — always behind a confirmation dialog

Neutral grays handle all hierarchy, borders, and surfaces. The palette never accumulates: at any moment, only one action color is dominant on screen.

---

# Typography

Inter throughout — geometric, highly legible, free, system-fallback-friendly. Major-third scale (×1.25) gives clear hierarchy without shouting. JetBrains Mono for generated markdown output only — signals "this is machine output you will take with you."

| Role                 | Size     | Weight | Line-height |
| -------------------- | -------- | ------ | ----------- |
| Page title / Hero    | 2.441rem | 700    | 1.2         |
| Section heading (h2) | 1.953rem | 700    | 1.3         |
| Subsection (h3)      | 1.563rem | 600    | 1.3         |
| Card heading         | 1.25rem  | 600    | 1.4         |
| Body                 | 1rem     | 400    | 1.6         |
| Small / label        | 0.875rem | 400    | 1.5         |
| Caption / badge      | 0.75rem  | 500    | 1.4         |
| Mono (output)        | 0.875rem | 400    | 1.7         |

## Layout & Spacing

## Authenticated layout (all routes)

Fixed left sidebar (240px) + main content area. Sidebar collapses to icon-only on mobile (< 768px) — a bottom navigation bar replaces it at small breakpoints. Main content: max 720px centered within the remaining space for forms and prose. Wider for tables and list views.

Sign-in and sign-up pages: single-column centered, max 480px, no sidebar.

Section vertical rhythm: 32px between major sections. Card internal padding: 24px.

---

# Elevation & Depth

Flat. Cards use border, not shadow. Elevation hierarchy:

- **Level 0 — page background:** `{colors.background}`
- **Level 1 — surface / sidebar:** `{colors.surface}` with `{colors.border}` separation
- **Level 2 — cards on surface:** `{colors.surface-raised}` (white on gray-50) with border
- **Level 3 — modals / drawers:** shadow (`{components.modal.shadow}`) over overlay
- **Toasts:** always float above Level 3

No decorative box-shadows on cards or panels. Depth is structural, not decorative.

---

# Shapes

Soft, consistent rounded corners. Nothing fully square, nothing pill-shaped except toggles and step indicators.

- XS (4px): badges, inline chips
- SM (6px): inputs, buttons — the default interactive element radius
- MD (8px): cards, panels
- LG (12px): drawers, modals, wizard container
- Full (pill): mode toggle segments, wizard step circles, progress fills

---

# Components

## App Shell — Authenticated

Fixed left sidebar with: Archer wordmark, primary navigation (Inbox, Goals, Engage, Weekly Review), user avatar + settings at bottom. Sidebar background: `{colors.surface}`. Active nav item: `{components.sidebar.nav-item-active-bg}` with primary text.

Top bar (mobile only): wordmark left, hamburger right. Bottom nav: Inbox, Goals, Engage, Review — icons + labels.

A persistent floating capture button (keyboard: `C`) sits bottom-right in all authenticated views. Tapping/clicking it opens the Inbox capture drawer without navigating away.

## Mode Toggle

Not used for unauthenticated/authenticated switching — there is no unauthenticated mode. Used in authenticated views where a segmented control is needed (e.g. filtering project statuses, toggling between list and detail view modes). Pill-shaped: active segment uses `{colors.primary}` fill with white text; inactive uses `{colors.surface}` background with muted text. Full-radius pill container.

## Wizard Stepper

Horizontal on desktop, vertical on mobile (< 640px). Four numbered circles connected by a line:

1. Circle: `{components.wizard-stepper.step-size}` (32px)
2. Complete step: emerald fill + white checkmark
3. Active step: primary fill + white number
4. Upcoming step: gray fill + muted number

Step labels beneath each circle on desktop; omitted (icon only) on mobile. Connector line: full width between circles, fills emerald as steps complete.

## Gap Rating Slider

Used in Wizard Step 2. Per skill/attribute row:

- Label (skill name) + required level chip (e.g. "Required: 8") on the left
- Horizontal slider (1–10) with real-time value readout
- Gap calculation renders live: "Gap: 5" in amber if gap ≥ 4, neutral otherwise
- Track: `{components.gap-slider.track-bg}`. Fill: `{components.gap-slider.fill-bg}`.

## Status Badge

Inline pill. Seven statuses: Active (blue), Paused (amber on amber-subtle), Someday (gray outlined), Completed (emerald on emerald-subtle), Archived (gray), Not now (red on red-subtle). See `{components.badge.*}` tokens.

## Action Item Row

Used in project views and Engage view. Structure: checkbox left — action text — optional context tag chips right.

- Available: default border
- Committed: `{components.action-item.committed-border}` + `{components.action-item.committed-bg}` — visually distinguished as "the one thing for this project"
- Done: line-through text, muted color, checkbox checked

Only one committed action per project at any time. Visual treatment must make this obvious at a glance.

## Stuck Indicator

Amber warning band at the top of a project card or as an inline flag in the Engage view. Text: "No committed next action — this project is stuck." with a direct CTA: "Commit one now". Never hidden, never subtle — amber because it needs attention but is not destructive.

## Inbox Item Row

Minimal: raw text + capture timestamp + overflow menu (Process | Delete). No pre-classification — inbox items look intentionally raw, unstructured.

## Weekly Review Phase Bar

Horizontal progress indicator at the top of the review view. Five beats (not three): **Snapshot (open)** → **Get Clear** → **Get Current** → **Get Creative** → **Snapshot (close)**. Active beat fills primary. Completed beats fill emerald. Upcoming: gray. Beat label below each segment. The two Snapshot beats are visually distinct — slightly narrower segments — to signal they are bookends, not phases.

## Output Panel (Project Mode generation)

Card container rendering `react-markdown` output. Monospace font (`{typography.font-mono}`) for the generated template text — signals "this is the artifact, not interface copy." On successful generation, the user is navigated automatically to the new Project detail view. No copy or download buttons anywhere in the product — output is persisted to Supabase.

## Vault Unlock Screen

Centered single-column form over surface background. Lock icon above passphrase input. Primary CTA: "Unlock vault". Secondary link: "Create new vault". Security-first visual register — no color, minimal surface. Accessible from the header lock icon at any time regardless of auth state.

---

# Do's and Don'ts

**Do:**

- Keep every view feeling like a tool, not a dashboard or marketing page
- Use whitespace as structure — density should increase only when the user is deep in work (weekly review, action lists)
- Make the GTD hierarchy (Goal → Project → Action) visually obvious at every level
- Treat amber warnings (stuck projects, inbox backlog) as signal, not decoration
- Make committed next actions visually unmistakable — they are the only thing the user should act on today

**Don't:**

- Add decorative illustrations, gradients, or icons that don't carry meaning
- Use more than one action color per screen at a time
- Show completion metrics, streaks, or progress bars that congratulate the user — Archer is not a habit tracker
- Hide stuck projects or overdue inbox items — surface them, every time
- Use modals for anything that doesn't require a binary decision or a destructive confirmation
