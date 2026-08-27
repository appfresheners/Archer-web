# Deferred Work Ledger

## Deferred from: code review of 2-2/2-3 (2026-08-27)

- ModeToggle tabs missing `aria-controls` and `id` attributes — WAI-ARIA tablist pattern recommends associating tabs with panels via id/aria-controls. Not blocking since this design doesn't use formal tabpanels. [archer/components/ModeToggle.tsx]
- ModeToggle tabs don't handle Home/End keys — WAI-ARIA tablist recommends Home/End for first/last tab. Not critical for a 2-tab toggle. [archer/components/ModeToggle.tsx]

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-copy-markdown-to-clipboard.md`
  summary: Add focus trap to fallback clipboard modal (Tab cycles between textarea and Close button)
  evidence: WCAG aria-modal contract requires focus to remain within the dialog; currently focus can escape to background content

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-copy-markdown-to-clipboard.md`
  summary: Add aria-live announcement for clipboard failure case (fallback modal shown)
  evidence: Screen reader users get no audible notification that the copy failed; the modal's role="dialog" provides some signal but an explicit announcement would be more accessible

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-download-as-markdown-file.md`
  summary: Add focus trap to fallback clipboard modal so keyboard users cannot Tab behind the overlay
  evidence: Backdrop div lacks tabIndex and focus-trap mechanism; Tab navigates to obscured page content violating WCAG 2.4.3

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-download-as-markdown-file.md`
  summary: Return focus to the trigger button when fallback modal closes
  evidence: WAI-ARIA dialog pattern requires focus return to previously-focused element on dismiss

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-download-as-markdown-file.md`
  summary: Add backdrop tabIndex to modal so Escape key handler fires on keyboard interaction
  evidence: Backdrop onKeyDown never fires because the div has no tabIndex attribute

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-download-as-markdown-file.md`
  summary: Add loading/disabled state on Copy button while async clipboard write is pending
  evidence: Rapid clicks can queue multiple clipboard writes and flash confirmation text erratically
