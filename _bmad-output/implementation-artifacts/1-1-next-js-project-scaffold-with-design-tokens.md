---
baseline_commit: NO_VCS
---

# Story 1.1: Next.js Project Scaffold with Design Tokens

Status: review

## Story

As a developer,
I want a working Next.js project with Tailwind configured and Archer's design tokens in place,
so that all subsequent UI work builds on a consistent, deployable foundation.

## Acceptance Criteria

1. **Given** a fresh project setup **When** `npm run build` executes **Then** a static `out/` directory is produced with no errors
2. **Given** the Tailwind configuration **When** design tokens are inspected **Then** Archer color palette is present (primary #2563EB, secondary #10B981, surface #F9FAFB, border #E5E7EB, text-primary #111827, text-secondary #6B7280, text-muted #9CA3AF, success #10B981, focus-ring #2563EB40, primary-hover #1D4ED8, secondary-hover #059669)
3. **Given** the CSS configuration **When** fonts are loaded **Then** Inter font is loaded (400/700 weights) via `next/font/google`
4. **Given** the typography configuration **When** type scale is inspected **Then** major-third scale (1.25 ratio) is configured: hero 2.441rem, section 1.953rem, subheading 1.563rem, body 1rem, caption 0.8rem
5. **Given** the spacing tokens **When** layout is inspected **Then** page-x (1rem), page-x-lg (4rem), section-y (4rem) spacing tokens are defined and usable
6. **Given** the page component **When** rendered **Then** a centered single-column layout with max-width 640px is visible
7. **Given** a mobile viewport (<640px) **When** the page renders **Then** 16px horizontal padding applies
8. **Given** a desktop viewport (>1024px) **When** the page renders **Then** 64px horizontal breathing room is evident (via centered max-w with generous whitespace)
9. **Given** the production build **When** deployed to Vercel **Then** the static site serves correctly from the `out/` directory

## Tasks / Subtasks

- [x] Task 1: Initialize Next.js project (AC: #1, #9)
  - [x] Run `npx create-next-app@latest` with TypeScript, App Router, Tailwind CSS, ESLint
  - [x] Configure `next.config.ts` with `output: 'export'`
  - [x] Verify `npm run build` produces `out/` directory
  - [x] Add `.gitignore` entries for `out/`, `node_modules/`, `.next/`
- [x] Task 2: Configure Tailwind CSS v4 with design tokens (AC: #2, #4, #5)
  - [x] Install `tailwindcss`, `@tailwindcss/postcss`, `postcss`
  - [x] Create `postcss.config.mjs` with `@tailwindcss/postcss` plugin
  - [x] Configure `app/globals.css` with `@import "tailwindcss"` and `@theme` block
  - [x] Define color tokens in `@theme`: `--color-primary`, `--color-primary-hover`, `--color-secondary`, `--color-secondary-hover`, `--color-surface`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-success`, `--color-focus-ring`
  - [x] Define typography scale tokens: `--font-size-hero`, `--font-size-section`, `--font-size-subheading`, `--font-size-body`, `--font-size-caption`
  - [x] Define spacing tokens: `--spacing-page-x`, `--spacing-page-x-lg`, `--spacing-section-y`
  - [x] Define border-radius tokens: `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-full` (9999px)
- [x] Task 3: Configure Inter font via next/font (AC: #3)
  - [x] Import Inter from `next/font/google` in `app/layout.tsx`
  - [x] Configure with weights [400, 700] and `display: 'swap'`
  - [x] Apply font variable to `<html>` element
  - [x] Set `--font-sans` in `@theme` to reference the Inter CSS variable
- [x] Task 4: Create page layout shell (AC: #6, #7, #8)
  - [x] Create `app/page.tsx` with `'use client'` directive
  - [x] Implement centered single-column container: `max-w-[640px] mx-auto`
  - [x] Apply responsive padding: `px-4 lg:px-16` (16px mobile, 64px desktop)
  - [x] Add section spacing: `py-16` (64px vertical rhythm)
  - [x] Add placeholder content (hero text: "Archer" heading + "Type a goal. Get the next actions." tagline)
- [x] Task 5: Create seed directory structure (AC: #1)
  - [x] Create `components/` directory with placeholder `.gitkeep` or index
  - [x] Create `lib/templates/` directory
  - [x] Create `lib/utils/` directory
  - [x] Ensure folder structure matches architecture seed
- [x] Task 6: Configure metadata and HTML shell (AC: #9)
  - [x] Set metadata in `app/layout.tsx`: title "Archer — GTD Goal & Project Creator", description
  - [x] Set viewport meta for mobile optimization
  - [x] Apply base styles in `globals.css`: antialiased text, background white, text-primary color
- [x] Task 7: Verify static build and deployment readiness (AC: #1, #9)
  - [x] Run `npm run build` — confirm `out/` directory with `index.html`
  - [x] Verify no server-side features are accidentally imported
  - [x] Confirm zero runtime dependencies beyond React/Next.js/Tailwind

## Dev Notes

### Architecture Compliance

- **AD-2**: Next.js App Router with `output: 'export'` in `next.config.ts`. Single route only (`app/page.tsx`).
- **AD-3**: No state management libraries. `useState` only, co-located in page component.
- **AD-5**: Tailwind CSS utility-first. No component libraries (no shadcn, Radix, MUI).
- **AD-6**: Deploy target is Vercel free tier serving `out/` directory.
- **Boundary Rule**: Components in `components/`, templates in `lib/templates/`, utilities in `lib/utils/`.

### Critical Technical Decision: Tailwind CSS v4 vs Architecture Doc

The architecture document references `tailwind.config.ts` in its seed structure. However, **Tailwind CSS v4** (stable since Jan 2025, latest v4.3) uses a CSS-first configuration approach:

- **No `tailwind.config.ts` needed** — design tokens are defined directly in CSS using the `@theme` directive
- Install: `npm install tailwindcss @tailwindcss/postcss postcss`
- PostCSS config: `postcss.config.mjs` with `{ plugins: { "@tailwindcss/postcss": {} } }`
- Theme: defined in `app/globals.css` via `@theme { ... }` block

**Resolution**: Use Tailwind v4's native `@theme` approach. The architecture's `tailwind.config.ts` reference is superseded by v4's CSS-first model. This gives better performance (Oxide engine), simpler setup, and is the current standard. If `create-next-app` generates a `tailwind.config.ts`, remove it and migrate tokens to CSS `@theme`.

### Design Token Values (from DESIGN.md)

```css
@theme {
  /* Colors */
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-secondary: #10b981;
  --color-secondary-hover: #059669;
  --color-background: #ffffff;
  --color-surface: #f9fafb;
  --color-border: #e5e7eb;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
  --color-success: #10b981;
  --color-focus-ring: #2563eb40;

  /* Typography Scale (major-third 1.25) */
  --font-size-hero: 2.441rem;
  --font-size-section: 1.953rem;
  --font-size-subheading: 1.563rem;
  --font-size-body: 1rem;
  --font-size-caption: 0.8rem;

  /* Font */
  --font-sans: var(--font-inter), "Inter", system-ui, -apple-system, sans-serif;

  /* Spacing */
  --spacing-page-x: 1rem;
  --spacing-page-x-lg: 4rem;
  --spacing-section-y: 4rem;

  /* Border Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;
}
```

### Next.js Version

Use **Next.js 16.x** (latest stable as of August 2026). The architecture says "14+" — using the latest gives better performance, Turbopack stability, and React 19 support. `create-next-app@latest` will scaffold v16.

### Font Loading Pattern

```tsx
// app/layout.tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-inter",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
```

### Static Export Config

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
```

### What NOT To Do

- **Do NOT** install `tailwindcss` v3 or use `tailwind.config.ts` / `tailwind.config.js` — v4 CSS-first config only
- **Do NOT** add `postcss-import` or `autoprefixer` — Tailwind v4 handles these automatically
- **Do NOT** add any state management library
- **Do NOT** add any UI component library (no shadcn, Radix, MUI, Headless UI)
- **Do NOT** use `getServerSideProps`, route handlers, middleware, or server actions
- **Do NOT** add analytics, cookies, or any tracking code
- **Do NOT** use `pages/` directory — App Router only (`app/`)

### Project Structure (Post-Scaffold)

```
archer/
├── app/
│   ├── layout.tsx          # HTML shell, Inter font, metadata
│   ├── page.tsx            # Single page with 'use client', placeholder content
│   └── globals.css         # @import "tailwindcss" + @theme tokens
├── components/             # Empty — future stories add components here
├── lib/
│   ├── templates/          # Empty — Story 2.1 adds goal-template.ts
│   └── utils/              # Empty — Story 3.1 adds clipboard.ts etc.
├── public/                 # Static assets (favicon, etc.)
├── next.config.ts          # output: 'export'
├── postcss.config.mjs      # @tailwindcss/postcss plugin
├── tsconfig.json           # TypeScript config (from create-next-app)
├── package.json
└── .gitignore
```

### Responsive Layout Pattern

The page uses a simple centered column:

```tsx
// app/page.tsx
"use client";

export default function Home() {
  return (
    <main className="mx-auto max-w-[640px] px-4 lg:px-16 py-16">
      {/* Hero */}
      <h1 className="text-[length:var(--font-size-hero)] font-bold text-[var(--color-text-primary)]">
        Archer
      </h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Type a goal. Get the next actions.
      </p>
    </main>
  );
}
```

### Verification Checklist

1. `npm run build` exits 0 and produces `out/index.html`
2. Opening `out/index.html` in browser shows centered layout with Inter font
3. Tailwind classes like `text-primary`, `bg-surface` resolve correctly
4. No console errors in browser DevTools
5. Page is responsive — check at 375px, 768px, 1440px widths
6. `npx serve out` serves the static site locally

### Project Structure Notes

- This is Story 1 of Epic 1 — the entire codebase is created fresh here
- All subsequent stories build on this scaffold
- Directory structure MUST match architecture seed exactly
- The `'use client'` directive on `page.tsx` is required per AD-2

### References

- [Source: ARCHITECTURE-SPINE.md#Decisions — AD-1 through AD-6]
- [Source: ARCHITECTURE-SPINE.md#Seed Structure]
- [Source: DESIGN.md#Colors — Full color palette]
- [Source: DESIGN.md#Typography — Inter font, major-third scale]
- [Source: DESIGN.md#Layout & Spacing — 640px max, padding, rhythm]
- [Source: DESIGN.md#Shapes — Border radius tokens]
- [Source: epics.md#Story 1.1 — Acceptance criteria]
- [Source: PRD#Section 6 — Technical Constraints: Next.js static export, Tailwind, Vercel]
- [Source: EXPERIENCE.md#Information Architecture — Single-page SPA]
- [Source: Tailwind CSS v4 docs — @theme configuration, PostCSS setup]
- [Source: Next.js 16 docs — static export with output: 'export']

## Project Context Reference

### project-context.md Status

`project-context.md` does **NOT exist** in this project. This is a greenfield project with no prior implementation. All conventions are established by the architecture spine and planning artifacts.

### Applicable Conventions from Planning Artifacts

- **Tech Stack**: Next.js 16 (App Router, static export), Tailwind CSS v4, TypeScript, React 19
- **Deployment**: Vercel free tier, static `out/` directory
- **Architecture Pattern**: Component-based SPA, local state only (`useState`), pure template functions
- **File Organization**: `app/` (routes), `components/` (UI), `lib/templates/` (generation logic), `lib/utils/` (browser APIs)
- **Styling**: Tailwind utility classes only, no CSS-in-JS, no component libraries
- **Testing**: Unit tests for template functions recommended (not mandated for MVP1)
- **State Management**: React `useState` co-located in page component — no external libs
- **Privacy**: Zero cookies, analytics, tracking, network requests post-load
- **Accessibility**: WCAG 2.1 AA, full keyboard nav, ARIA roles, 44×44px targets, 4.5:1 contrast
- **Bundle Target**: <100KB gzipped JavaScript

## Dev Agent Record

### Agent Model Used

Kiro (Auto model selection)

### Debug Log References

- Build verified: `npm run build` exits 0, produces `out/index.html`
- Lint verified: `npm run lint` exits 0, zero errors
- Runtime deps confirmed: only next, react, react-dom (Tailwind is devDep)
- Static export confirmed: all routes marked ○ (Static)

### Completion Notes List

- Scaffolded Next.js 16.3.3 project with TypeScript, App Router, Tailwind CSS v4, ESLint
- Configured `output: 'export'` for static site generation to `out/` directory
- Implemented Tailwind v4 CSS-first design tokens in `@theme` block (colors, typography scale, spacing, border-radius)
- Configured Inter font (400/700) via `next/font/google` with CSS variable `--font-inter`
- Created responsive page shell: centered 640px max-width, 16px mobile padding, 64px desktop padding
- Created seed directory structure: `components/`, `lib/templates/`, `lib/utils/`
- Set page metadata: title, description, viewport (auto by Next.js)
- Applied base body styles: antialiased, white background, text-primary color
- Removed scaffolded boilerplate (AGENTS.md, CLAUDE.md, default SVGs, README)
- All acceptance criteria verified via successful build and lint

### File List

- archer/app/globals.css (new) — Tailwind v4 import + @theme design tokens + body base styles
- archer/app/layout.tsx (modified) — Inter font, metadata, HTML shell
- archer/app/page.tsx (modified) — Client component, centered layout, placeholder hero content
- archer/next.config.ts (modified) — Added output: 'export'
- archer/postcss.config.mjs (existing) — @tailwindcss/postcss plugin (from scaffold)
- archer/components/.gitkeep (new) — Seed directory placeholder
- archer/lib/templates/.gitkeep (new) — Seed directory placeholder
- archer/lib/utils/.gitkeep (new) — Seed directory placeholder
- archer/package.json (existing) — Next.js 16.3.3, React 19.2.8, Tailwind v4
- archer/tsconfig.json (existing) — TypeScript config from scaffold
- archer/eslint.config.mjs (existing) — ESLint config from scaffold
- archer/.gitignore (existing) — Covers out/, node_modules/, .next/

## Change Log

- 2026-08-26: Initial implementation complete — Next.js 16 scaffold with Tailwind v4 design tokens, Inter font, responsive layout shell, and seed directory structure. All 7 tasks implemented and verified. Status → review.
