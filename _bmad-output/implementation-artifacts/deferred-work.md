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

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-notion-optimized-markdown-quality.md`
  summary: escapeMarkdown does not neutralize user input containing `<!--` sequences which could produce HTML comment artifacts in rendered markdown
  evidence: Pre-existing behavior from Epic 2; escapeMarkdown escapes common markdown special chars but HTML comment delimiters are not in its character class

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-notion-optimized-markdown-quality.md`
  summary: escapeMarkdown does not handle literal newlines or carriage returns in user input which could break table structure
  evidence: Pre-existing behavior from Epic 2; input field is single-line so risk is minimal but the function itself has no newline handling

- source_spec: none
  summary: Extract escapeMarkdown into shared utility (duplicated in goal-template.ts and project-template.ts)
  evidence: Blind-hunter review identified code duplication; both template files define identical escapeMarkdown functions
  status: done

- source_spec: none
  summary: Add input length validation to /api/generate route to prevent prompt injection and cost inflation
  evidence: Blind-hunter review; no maxLength check on user input before concatenating into LLM prompt
  status: done

- source_spec: none
  summary: Add AbortController timeout to outbound fetch calls in /api/generate route
  evidence: Blind-hunter review; if a provider hangs the serverless function will exhaust its execution budget
  status: done

- source_spec: none
  summary: Move Gemini API key from URL query parameter to x-goog-api-key header
  evidence: Blind-hunter review; key in URL leaks to access logs and intermediate proxies
  status: done

- source_spec: none
  summary: Verify default Gemini model name (gemini-3.6-flash) is a valid model identifier
  evidence: Blind-hunter review; does not match known published Gemini model names — changed to gemini-2.0-flash
  status: done
