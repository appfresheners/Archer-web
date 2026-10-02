---
title: "Loading, Timeout & Provider Error Handling"
type: "feature"
created: "2026-09-27"
status: "done"
baseline_commit: "7dcd8e77dea478044e55154ceed94a28f4f18667"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.3 wired Project Mode generation end-to-end, but the in-flight and failure UX is bare: the submit button still reads "Break it down" while generating (only dimmed), and any failure shows one generic inline message with no retry and no timeout-vs-provider distinction. A user who hits the 30s timeout or a misconfigured API key is left without clear, actionable feedback.

**Approach:** Add explicit feedback for the two states the route already produces. While a request is in flight, the submit button shows a spinner and "Generating…" and the input/controls are disabled. On failure, surface a clear, accessible error with a "Try again" action that re-submits the same input (preserved), mapping the route's status to an actionable message: 504 → timeout guidance, 500 → the server's actionable message (which already carries API-key-misconfiguration guidance from `lib/ai`), network failure → a connection message. No new toast library — a focused accessible alert region with a retry button.

## Boundaries & Constraints

**Always:**

- While a generation request is in flight: the submit button shows a spinner and the label "Generating…", the button is disabled, and the text input and depth control are disabled. The user's input is never cleared.
- On a request that exceeds 30 seconds (the route returns 504): a user-facing error appears with a "Try again" action, and the user's typed input (and chosen depth) are preserved so retry needs no re-typing.
- On a provider/config error (the route returns 500 with an actionable message): that message is surfaced verbatim to the user (it already includes guidance such as "…Add GEMINI_API_KEY to …"). A network/unreachable failure surfaces a distinct connection message.
- The error surface is accessible: an assertive `role="alert"` region announces the message; the "Try again" control is a real focusable button that re-runs the last submit with the preserved input/depth.
- After a failure the form is re-enabled so the user can edit and resubmit; a successful navigation leaves the form disabled through the transition (no double-submit).

**Ask First:**

- Adding a global toast/notification system or a new dependency for it — prefer the local accessible alert region unless the human wants a shared toast.
- Changing the route's status codes or error messages (Stories 2.1/2.3 own those; this story consumes them).

**Never:**

- Do not clear or reset the user's input on error (must be preserved for retry).
- Do not change the generation, save, or navigation behavior (Story 2.3) — this is feedback UX only.
- Do not swallow the route's actionable 500 message behind a generic string.
- Do not add copy/download or output-on-input-page behavior.

## I/O & Edge-Case Matrix

| Scenario              | Input / State           | Expected Output / Behavior                                                            | Error Handling          |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------- | ----------------------- |
| In flight             | request pending         | Button: spinner + "Generating…", disabled; input + depth disabled; input value intact | N/A                     |
| Success               | route returns `{ id }`  | Navigate to `/app/projects/{id}`; form stays disabled through nav                     | N/A                     |
| Timeout               | route 504               | Alert with timeout message + "Try again"; input/depth preserved; form re-enabled      | 504 → timeout copy      |
| Provider/config error | route 500 `{ error }`   | Alert shows the server's actionable message (e.g. API-key guidance) + "Try again"     | 500 → verbatim message  |
| Network failure       | fetch throws            | Alert with a connection message + "Try again"; input preserved                        | catch → connection copy |
| Retry                 | user clicks "Try again" | Re-POSTs the same `{ input, depth }`; returns to in-flight state                      | N/A                     |
| Validation (empty)    | client-side, pre-submit | Existing inline validation (Story 2.2) still applies; no request                      | handled in 2.2          |

</frozen-after-approval>

## Code Map

- `components/projects/ProjectModeInput.tsx` -- **edit.** Add a `loading?: boolean` prop. When `loading`, the submit button renders a spinner + "Generating…" and is disabled; the text input and `DepthControl` are disabled (loading implies disabled). Keep the existing `disabled` prop for the plain disabled state and the empty-input `aria-disabled` behavior. The spinner mirrors the existing spinner markup in `app/page.tsx` (`animate-spin` ring using border tokens) — reuse that pattern, `motion-safe` so reduced-motion users don't see it spin.
- `app/app/projects/new/NewProjectClient.tsx` -- **edit.** Track the last submitted `{ input, depth }` so "Try again" can re-run it. Map the response: `res.status === 504` → timeout copy; `!res.ok` (e.g. 500) → `payload.error` (the server's actionable message) or a fallback; `fetch` throw → connection copy. Render an accessible error region (`role="alert"`, `aria-live="assertive"`) containing the message and a "Try again" button that re-invokes the submit with the preserved values. Pass `loading={inFlight}` to `ProjectModeInput`. Preserve current success behavior (navigate on `{ id }`, stay disabled through nav).
- `app/page.tsx` -- **reference only.** Source of the existing spinner markup + "Generating…" copy to mirror; do not modify (Story 2.6 removes it).
- `components/auth/SignInForm.tsx` -- **reference only.** Pattern for `role="alert"` inline error styling with the destructive tokens.

## Tasks & Acceptance

**Execution:**

- [x] `components/projects/ProjectModeInput.tsx` -- Add `loading?: boolean`: spinner + "Generating…" label on the (disabled, `aria-busy`) button while loading; disable input + depth control while loading; never clear input. Preserve existing validation/disabled behavior.
- [x] `app/app/projects/new/NewProjectClient.tsx` -- Remember the last `{ input, depth }`; map 504 → timeout message, 500 → server `error` message, fetch-throw → connection message; render an assertive `role="alert"` region with a "Try again" button that re-submits the preserved values; pass `loading={inFlight}`.
- [x] `components/projects/ProjectModeInput.test.tsx` -- Extend: when `loading`, the button shows "Generating…" and is disabled and the input/depth are disabled; input value is not cleared by toggling loading.
- [x] `app/app/projects/new/NewProjectClient.test.tsx` -- Extend: 504 shows the timeout message + "Try again"; 500 surfaces the server `error` message; a network throw shows the connection message; clicking "Try again" re-POSTs the same `{ input, depth }` and does not require re-typing. (Review added: idless-200 no-nav + empty-body 504/500 fallbacks.)

**Acceptance Criteria:**

- Given a generation request in flight, when I wait, then the button shows a spinner and "Generating…" and the input is disabled.
- Given a request that exceeds 30 seconds, when the timeout fires, then a user-facing error appears with a retry option and my input is preserved.
- Given the provider returns an error, when it is surfaced, then the message is clear and actionable, including guidance for API-key misconfiguration (e.g. "…Add GEMINI_API_KEY to …").

## Design Notes

The route already distinguishes 504 (timeout) from 500 (provider/config, with the actionable key-guidance message baked in by `lib/ai`), so the client's job is faithful mapping + retry, not re-deriving messages. "Try again" re-runs the captured last submit rather than reading form state, so it is robust even if focus/state shifts. `loading` is a separate prop from `disabled` because the two states look different (spinner + "Generating…" vs. a plain dimmed button for the empty state), and keeping them distinct avoids overloading one flag. Reduced-motion users get a non-spinning affordance via `motion-safe`.

Example spinner (mirrors the existing one):

```tsx
<span
  className="mr-2 inline-block h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]"
  aria-hidden="true"
/>
```

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: types check.
- `npm test` -- expected: extended `ProjectModeInput` + `NewProjectClient` tests pass; existing suite green.
- `npm run lint` -- expected: no new errors.
- `npm run build` -- expected: succeeds; standalone intact.

**Manual checks:**

- Trigger a slow/timeout response and confirm the retry preserves the typed input and depth.
- Confirm a 500 with an API-key message shows that guidance verbatim.

## Suggested Review Order

**Failure/loading orchestration (entry point)**

- Entry point — `run()`: success→navigate, else map status→message; captures `lastSubmit` for retry.
  [`NewProjectClient.tsx:41`](../../app/app/projects/new/NewProjectClient.tsx#L41)

- Status mapping — 504→timeout copy, other !ok→server message/generic, fetch throw→connection copy.
  [`NewProjectClient.tsx:72`](../../app/app/projects/new/NewProjectClient.tsx#L72)

- Accessible error surface + "Try again" re-running the preserved submission (no re-typing).
  [`NewProjectClient.tsx:97`](../../app/app/projects/new/NewProjectClient.tsx#L97)

**In-flight affordance**

- `loading` prop: spinner + "Generating…" on the disabled button (`aria-busy`), input + depth disabled, input never cleared.
  [`ProjectModeInput.tsx:129`](../../components/projects/ProjectModeInput.tsx#L129)

**Supporting**

- Client mapping coverage: 500 verbatim, 504 + retry, network, idless-200 no-nav, empty-body fallbacks, retry re-POSTs identical body.
  [`NewProjectClient.test.tsx:1`](../../app/app/projects/new/NewProjectClient.test.tsx#L1)

- Loading-state coverage: Generating… + disabled controls, input preserved.
  [`ProjectModeInput.test.tsx:1`](../../components/projects/ProjectModeInput.test.tsx#L1)
