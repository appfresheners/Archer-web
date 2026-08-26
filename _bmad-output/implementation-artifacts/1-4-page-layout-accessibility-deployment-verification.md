# Story 1.4: Page Layout, Accessibility & Deployment Verification

Status: ready-for-dev

## Story

As a user,
I want the page to load fast, look polished on any device, and be fully keyboard-navigable,
so that I can use Archer regardless of device, connection speed, or assistive technology.

## Acceptance Criteria

1. **Given** the deployed site **When** tested with Lighthouse on mobile **Then** performance score is ≥ 95, LCP < 1.5s, CLS < 0.1
2. **Given** a mobile viewport (< 640px) **When** I view the page **Then** content fills full width with 16px padding, all elements are stacked
3. **Given** a desktop viewport (> 1024px) **When** I view the page **Then** content is centered at max-width 640px with generous whitespace
4. **Given** I use only keyboard navigation **When** I tab through the page **Then** focus order is: mode toggle → input → generate button **And** focus indicators are clearly visible
5. **Given** `prefers-reduced-motion` is enabled **When** any animation would normally play **Then** it is suppressed
6. **Given** body text is inspected **When** contrast ratio is measured **Then** it meets 4.5:1 minimum (WCAG AA)
7. **Given** the JavaScript bundle **When** measured gzipped **Then** it is < 100KB

## Tasks / Subtasks

- [ ] Task 1: Audit and fix responsive layout (AC: #2, #3)
  - [ ] Verify `page.tsx` layout: `mx-auto max-w-[640px] px-[var(--spacing-page-x)] lg:px-[var(--spacing-page-x-lg)]` provides correct spacing
  - [ ] Test at 375px width: content fills viewport minus 16px horizontal padding on each side
  - [ ] Test at 768px width: content still within max-width, appropriate padding
  - [ ] Test at 1440px width: content centered, max-width 640px, breathing room on both sides
  - [ ] Verify all child elements (ModeToggle, InputSection) fill available width appropriately
  - [ ] Ensure no horizontal overflow on any tested viewport
  - [ ] Add `min-h-screen` to body/layout if not already present for proper vertical page fill

- [ ] Task 2: Verify and fix keyboard navigation (AC: #4)
  - [ ] Verify tab order follows DOM order: ModeToggle → Input → Generate button
  - [ ] Confirm ModeToggle's internal arrow key navigation works (left/right cycles between Goal/Project)
  - [ ] Verify focus indicators: all interactive elements show visible focus ring on focus
  - [ ] Focus ring pattern: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]`
  - [ ] Verify no focus traps — user can tab through entire page and exit naturally
  - [ ] Confirm Generate button is reachable and activatable via keyboard (Enter/Space)
  - [ ] Write a test asserting tab order matches expected sequence

- [ ] Task 3: Verify prefers-reduced-motion support (AC: #5)
  - [ ] Audit all existing `motion-safe:` and `motion-reduce:` utility usage
  - [ ] ModeToggle: transitions use `motion-safe:transition-colors motion-safe:duration-150` ✓
  - [ ] Generate button: hover transition uses `motion-safe:transition-colors motion-safe:duration-150` ✓
  - [ ] Confirm no animations fire when `prefers-reduced-motion: reduce` is active
  - [ ] Write a test that asserts animations respect motion preference (mock matchMedia)

- [ ] Task 4: Verify color contrast compliance (AC: #6)
  - [ ] Primary text (gray-900 `#111827` on white `#FFFFFF`): contrast ratio ≥ 4.5:1 ✓ (15.39:1)
  - [ ] Secondary text (gray-500 `#6B7280` on white `#FFFFFF`): contrast ratio ≥ 4.5:1 ✓ (5.02:1)
  - [ ] Muted/placeholder text (gray-400 `#9CA3AF` on white `#FFFFFF`): **VERIFY** — may be below 4.5:1 for body text
  - [ ] Button text (white `#FFFFFF` on primary `#2563EB`): contrast ratio ≥ 4.5:1 ✓ (4.63:1)
  - [ ] Disabled button text (white/60% on primary/40%): does NOT need to meet contrast (disabled elements exempt per WCAG)
  - [ ] Validation error text (red-600 `#DC2626` on white): contrast ratio ≥ 4.5:1 ✓ (4.49:1 — borderline, verify)
  - [ ] If any contrast fails, adjust the color token in `globals.css` or the component class
  - [ ] Note: Placeholder text (text-muted) is exempt from 4.5:1 per WCAG (only informational, user replaces it)

- [ ] Task 5: Verify and optimize bundle size (AC: #7)
  - [ ] Run `npm run build` and check `.next/diagnostics/route-bundle-stats.json` for JS sizes
  - [ ] Verify total JS delivered to client is < 100KB gzipped
  - [ ] If over budget: audit imports for tree-shaking issues
  - [ ] Confirm no unnecessary imports (all React, Next.js imports are standard)
  - [ ] Check that Tailwind CSS purges unused utilities (Tailwind v4 does this by default)
  - [ ] Document final bundle size in Dev Notes

- [ ] Task 6: Lighthouse performance validation (AC: #1)
  - [ ] Run `npm run build` to generate static `out/` directory
  - [ ] Verify the build produces a valid static export (no server-side only features)
  - [ ] Document expected Lighthouse metrics based on:
    - Static HTML + minimal JS → LCP should be < 1s
    - No layout shifts (fixed layout, no dynamic content loading) → CLS < 0.05
    - No heavy JS on main thread → FID < 50ms
  - [ ] Verify font loading strategy doesn't cause layout shift (Inter loaded via `next/font`)
  - [ ] Confirm no third-party scripts or analytics (NFR6 compliance)
  - [ ] Add meta viewport tag verification in layout.tsx

- [ ] Task 7: Deployment verification (AC: #1)
  - [ ] Verify `next.config.ts` has `output: 'export'` configured
  - [ ] Run `npm run build` — confirm zero errors, `out/` directory created
  - [ ] Verify `out/index.html` exists and is a complete HTML document
  - [ ] Confirm no server-side features that would block static deployment
  - [ ] Verify the build is deployable to Vercel free tier (static serving)
  - [ ] Document the deployment configuration in Dev Notes

- [ ] Task 8: Build, lint, and test verification (AC: all)
  - [ ] `npm run build` exits 0, produces `out/` directory
  - [ ] `npm run lint` exits 0, zero ESLint errors
  - [ ] `npm run test` — all existing 51 tests pass + any new tests added
  - [ ] No TypeScript errors in the codebase

## Dev Notes

### Architecture Compliance

- **AD-2**: Single route architecture — `app/page.tsx` with `'use client'` directive. No additional routes.
- **AD-5**: Tailwind CSS utility classes only. Design tokens from `globals.css` via `@theme`.
- **AD-6**: Static export via `output: 'export'` in `next.config.ts`. Deployed to Vercel free tier.
- **NFR1**: Lighthouse performance ≥ 95, LCP < 1.5s, CLS < 0.1
- **NFR2**: Fully static site, no server runtime
- **NFR3**: Mobile/tablet/desktop responsive
- **NFR4**: WCAG 2.1 Level AA
- **NFR7**: JS bundle < 100KB gzipped

### This Story is a VERIFICATION Story

Unlike Stories 1.1–1.3 which built new components, Story 1.4 is primarily a **verification and hardening** story. It validates that the existing implementation meets non-functional requirements. Tasks may result in:

- No code changes (if everything already passes)
- Minor tweaks to fix contrast, layout, or accessibility issues
- Documentation of actual performance metrics

### What MUST Be Verified (Not Built)

1. The layout is already implemented in `page.tsx` — verify it responds correctly at breakpoints
2. Keyboard navigation relies on DOM order — verify the order is correct
3. Motion preferences are already coded with `motion-safe:` — verify nothing else needs guarding
4. Color contrast depends on tokens in `globals.css` — verify ratios meet WCAG AA
5. Bundle size depends on existing dependencies — verify the total is under budget
6. Lighthouse score depends on the full page — verify after full build

### Design Token Reference

From `app/globals.css` (DO NOT MODIFY unless fixing contrast):

```css
--color-primary: #2563eb;
--color-primary-hover: #1d4ed8;
--color-secondary: #10b981;
--color-background: #ffffff;
--color-surface: #f9fafb;
--color-border: #e5e7eb;
--color-text-primary: #111827;
--color-text-secondary: #6b7280;
--color-text-muted: #9ca3af;
--color-focus-ring: #2563eb40;
--spacing-page-x: 1rem;
--spacing-page-x-lg: 4rem;
--spacing-section-y: 4rem;
```

### Contrast Ratios (Pre-calculated)

| Element          | Foreground | Background  | Ratio   | Passes?              |
| ---------------- | ---------- | ----------- | ------- | -------------------- |
| Body text        | #111827    | #FFFFFF     | 15.39:1 | ✓ AA                 |
| Secondary text   | #6B7280    | #FFFFFF     | 5.02:1  | ✓ AA                 |
| Placeholder text | #9CA3AF    | #FFFFFF     | 2.86:1  | Exempt (placeholder) |
| Button text      | #FFFFFF    | #2563EB     | 4.63:1  | ✓ AA                 |
| Error text       | #DC2626    | #FFFFFF     | 4.49:1  | ⚠️ Borderline        |
| Disabled button  | white/60%  | primary/40% | N/A     | Exempt (disabled)    |

**Action Required:** If error text `red-600` (#DC2626) doesn't meet 4.5:1, switch to `red-700` (#B91C1C) which gives ~5.74:1.

### Existing Component Focus Patterns

From Stories 1.2 and 1.3:

- **ModeToggle**: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]`
- **InputSection input**: `focus:border-primary focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:outline-none`
- **Generate button**: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]`

### Bundle Size Expectation

Expected composition:

- Next.js runtime: ~60-70KB gzipped
- React + ReactDOM: bundled with Next.js
- App code (page.tsx + 2 components): < 5KB
- Tailwind CSS (only used classes): ~10-15KB
- Total expected: ~75-85KB gzipped → within 100KB budget

### Tab Order (Expected Natural DOM Order)

```
1. ModeToggle "Goal" tab (first interactive element)
2. ModeToggle "Project" tab (internal arrow key nav within tablist)
3. Input field
4. Generate button
```

Within ModeToggle, the ARIA tablist pattern means only one tab is in the tab order at a time (the active one), and arrow keys move between tabs. This is correct per WAI-ARIA Authoring Practices.

### Font Loading Strategy

`next/font` with Inter handles:

- Font preloading (eliminates render-blocking request)
- `font-display: swap` (prevents invisible text during load)
- Self-hosting (no external network requests — NFR6 compliant)
- CSS variable injection for Tailwind consumption

### What NOT To Do

- **Do NOT** add any new components — this is a verification story
- **Do NOT** add analytics, tracking, or any third-party scripts (NFR6)
- **Do NOT** add heavy testing libraries (Lighthouse, axe-core CLI) as dev dependencies — document manual verification steps instead
- **Do NOT** modify component logic unless a specific WCAG/perf issue is found
- **Do NOT** add `tailwind.config.ts` — project uses Tailwind v4 CSS-first only
- **Do NOT** change the existing responsive layout unless broken at a specific breakpoint
- **Do NOT** use any UI component library

### Verification Approach

Since this is a quality gate story, the approach is:

1. Run build → verify output exists and is correct
2. Run lint → verify zero errors
3. Run tests → verify all 51 pass
4. Manual/automated viewport testing at 375px, 768px, 1440px
5. Keyboard walk-through → document tab order
6. Contrast calculation → verify or fix
7. Bundle analysis → document sizes
8. Lighthouse run (manual after deploy or via local static server)

### Previous Story Intelligence

From Story 1.3 (most recent):

- 51 total tests pass (29 ModeToggle + 22 InputSection)
- Build produces static export successfully
- Tailwind v4 CSS-first config works correctly
- `motion-safe:` pattern established for transitions
- `aria-disabled` pattern used (not HTML disabled) for accessibility
- Touch targets ≥ 44px on interactive elements
- All responsive: verified at 375px, 768px, 1440px in Story 1.3

### Existing Files (DO NOT MODIFY Unless Issue Found)

- `app/page.tsx` — page layout, component composition
- `app/layout.tsx` — HTML shell, Inter font, metadata
- `app/globals.css` — Tailwind directives + design tokens
- `components/ModeToggle.tsx` — segmented toggle control
- `components/InputSection.tsx` — input field + generate button
- `next.config.ts` — static export config

### Test Infrastructure

- **Framework**: Vitest with jsdom environment
- **Libraries**: @testing-library/react, @testing-library/jest-dom
- **Config**: `archer/vitest.config.ts`
- **Setup**: `archer/vitest.setup.ts` (imports jest-dom matchers)
- **Script**: `npm run test` (runs `vitest run`)
- **Current count**: 51 tests across components and page

### References

- [Source: ARCHITECTURE-SPINE.md#Decisions — AD-2, AD-5, AD-6]
- [Source: ARCHITECTURE-SPINE.md#Deferred — Testing strategy note]
- [Source: DESIGN.md#Layout & Spacing — responsive breakpoints, padding, max-width]
- [Source: DESIGN.md#Colors — contrast verification needed]
- [Source: DESIGN.md#Typography — Inter font, scale]
- [Source: epics.md#Story 1.4 — All acceptance criteria]
- [Source: epics.md#NFR1 — Lighthouse ≥ 95, LCP < 1.5s, CLS < 0.1]
- [Source: epics.md#NFR2 — Static deployment]
- [Source: epics.md#NFR3 — Responsive across devices]
- [Source: epics.md#NFR4 — WCAG 2.1 AA]
- [Source: epics.md#NFR5 — Browser compatibility]
- [Source: epics.md#NFR7 — Bundle < 100KB gzipped]
- [Source: epics.md#UX-DR1 — Inter font, type scale]
- [Source: epics.md#UX-DR8 — Responsive layout specs]
- [Source: epics.md#UX-DR9 — Focus management, tab order]
- [Source: epics.md#UX-DR10 — prefers-reduced-motion]
- [Source: epics.md#UX-DR11 — 44×44px touch targets]

## Project Context Reference

### project-context.md Status

`project-context.md` does **NOT exist** in this project. Conventions are derived from the architecture spine, planning artifacts, and established patterns from Stories 1.1–1.3.

### Applicable Conventions from Planning Artifacts

- **Tech Stack**: Next.js 16.3.3, React 19.2.8, Tailwind CSS v4, TypeScript 5.x
- **Styling**: Tailwind v4 CSS-first `@theme` tokens in `globals.css` — no `tailwind.config.ts`
- **Component Pattern**: Props-in, callbacks-out. State lives in page.tsx only.
- **File Organization**: `components/*.tsx` for UI, `lib/` for utilities, state in `app/page.tsx`
- **No Libraries**: Zero external UI or form or state management libraries
- **Accessibility**: WCAG 2.1 AA, full keyboard nav, focus-visible pattern, 44×44px targets, 4.5:1 contrast
- **Motion**: Use Tailwind `motion-safe:` variants for all transitions
- **Testing**: Vitest + React Testing Library (51 tests currently passing)
- **Build/Lint**: `npm run build` (static export), `npm run lint` (ESLint), `npm run test` (Vitest)
- **Import Paths**: Use `@/components/*` path alias
- **Deployment**: Vercel free tier, static `out/` directory
- **Font**: Inter via `next/font` (self-hosted, no CDN)
- **Design Tokens**: All colors, spacing, typography in CSS custom properties

## Change Log

- 2026-08-26: Story created — comprehensive verification guide for NFR compliance. Status → ready-for-dev.
