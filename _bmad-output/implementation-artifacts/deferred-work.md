# Deferred Work Ledger

## Deferred from: code review of 2-2/2-3 (2026-08-27)

- ModeToggle tabs missing `aria-controls` and `id` attributes — WAI-ARIA tablist pattern recommends associating tabs with panels via id/aria-controls. Not blocking since this design doesn't use formal tabpanels. [archer/components/ModeToggle.tsx]
- ModeToggle tabs don't handle Home/End keys — WAI-ARIA tablist recommends Home/End for first/last tab. Not critical for a 2-tab toggle. [archer/components/ModeToggle.tsx]
