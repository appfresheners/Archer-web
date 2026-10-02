---
title: "Portable Passwordless Identity (Link + QR)"
type: "feature"
created: "2026-08-31"
status: "done"
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: "75ef1ef71be3ad44961c3073af1ef488f18a699a"
context: []
warnings: []
deferred:
  - summary: >-
      Bound the on-screen lifetime of the revealed portable-identity link/QR
      (e.g. a hide/re-lock control or auto-obscure) and wire the existing
      session.lock() to the UI.
    evidence: |-
      Review: once revealed, identityLinkValue (the passphrase-bearing link)
      and the QR stay in component state and the DOM until the view unmounts;
      there is no hide button and lock() is never wired, so the unlock key can
      remain on screen indefinitely (shoulder-surf/screenshot exposure). The
      spec permits transient in-memory key material, so this is hardening.
    location: >-
      archer/components/SavedBreakdowns.tsx, archer/lib/vault/useVaultSession.ts
    severity: medium
  - summary: >-
      Verify the rendered QR actually encodes the identity link (decode-side
      assertion), not just that an SVG with alt text is present.
    evidence: |-
      Review: QR tests assert role="img" + aria-label + an <svg> exists, but
      nothing decodes the QR to confirm it carries the #key= link. A QR of the
      wrong/empty payload would pass. A decode assertion needs a QR-reader dep,
      out of proportion for now; QR is rendered by qrcode@1.5.4 from the exact
      link string.
    location: >-
      archer/components/SavedBreakdowns.tsx (QR render)
    severity: low
  - summary: >-
      Harden the qrcode CJS/ESM interop so a packaging change degrades to
      link-only instead of throwing at module load and breaking the whole
      saved-breakdowns view.
    evidence: |-
      Review: renderQrSvg is resolved at module-evaluation time via
      toString/default.toString; if a future bundler exposes qrcode
      differently the dereference throws during import, before any try/catch,
      taking down unlock/list/export/import too. Works under the current
      bundler (tests pass); defense-in-depth.
    location: >-
      archer/components/SavedBreakdowns.tsx (renderQrSvg resolution)
    severity: low
---

<intent-contract>

## Intent

**Problem:** A user with more than one device has no way to open their vault elsewhere without re-typing the passphrase. Epic 4 promises passwordless portability (FR27–FR29): the app should produce a saveable link and a QR code that carry the key material needed to unlock the vault on another device, with no account and nothing sent to any Archer server.

**Approach:** Add a pure `lib/vault/portable-identity.ts` module that encodes the vault's unlock key material (the session passphrase) into a URL fragment (`#key=...`) — a location the browser never transmits to a server (NFR8) — and decodes it back on load. Surface a "Portable identity" control in the saved-breakdowns view that shows the saveable link and a locally-rendered QR of that link, guarded by a clear security warning (FR29). On startup, if a portable-identity fragment is present, use it to unlock the vault without prompting for a passphrase (FR28), then scrub it from the URL. QR rendering is done client-side from the local string; no key material ever leaves the device.

## Boundaries & Constraints

**Always:**

- Run entirely client-side. Generating, rendering, reading, or consuming a portable identity makes no network request of any kind (NFR8).
- Carry key material only in the URL fragment (the part after `#`), which browsers do not send in HTTP requests, and/or in a locally-rendered QR of that same URL — never in a query string, path, cookie, header, or any request body (FR27, FR28, NFR8).
- The encoded key material is exactly what unlocks the vault: the session passphrase. Encode it reversibly (e.g. URL-safe base64 / `encodeURIComponent`) so decode is lossless; never derive, weaken, or re-hash it.
- Keep encode/decode/parse logic in a pure `lib/vault/` module, free of React; return typed results and never throw across the boundary (AR4/AR6).
- On load, when a portable-identity fragment is present, attempt an auto-unlock through the existing encrypted session (same passphrase→`listEntriesEncrypted` path as manual unlock); on success the vault opens with no manual passphrase prompt (FR28). Immediately remove the key material from the visible URL (e.g. `history.replaceState`) so it is not left in the address bar or history.
- Before showing or copying a portable identity, display a clear, unmissable security warning that anyone holding the link/QR can unlock the vault and it must be stored securely (FR29).
- Only offer to generate a portable identity when the session is unlocked (a passphrase exists to encode). QR is rendered locally from the link string.
- All new UI meets WCAG 2.1 AA consistent with 4.3/4.4 controls: keyboard operable, correct ARIA/labels, ≥44×44px targets, contrast via existing tokens, reduced-motion respected (NFR10). The QR image carries a meaningful text alternative.
- If a QR-rendering library is introduced, it must be a well-known, actively-maintained package pinned to an exact version, used purely client-side for offline rendering, and must not perform crypto or any network I/O.

**Block If:**

- Meeting "unlocked without a manual passphrase prompt" requires changing the 4.2 crypto or the `EncryptedVaultEnvelope`/`VaultSchema` shape (the passphrase-as-key model must carry the auto-unlock). The 4.2 design is settled; if a real schema/crypto change is required, HALT with blocking condition `vault schema change required`.
- The intent cannot be met without transmitting key material to a server or an unavoidable third-party network endpoint (no purely-local QR path exists). HALT with blocking condition `local-only portability impossible`.

**Never:**

- No account, sign-up, passphrase-prompt-on-arrival, or any server-side record of the identity (FR28, NFR8).
- No sending key material to any Archer-owned server or third-party endpoint; nothing in a query string, path, request header/body, cookie, or analytics call.
- No new server-side storage or API route.
- No third-party CRYPTO dependency and no change to `crypto.ts` primitives or the persisted envelope/schema in `types.ts`.
- No persisting the portable-identity key material to `localStorage` or anywhere at rest; it lives only transiently in the fragment/QR and in-memory session.
- No export/import file changes (Story 4.4) beyond what portability needs.

## I/O & Edge-Case Matrix

| Scenario                      | Input / State                                 | Expected Output / Behavior                                                      | Error Handling                                                     |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Encode identity               | Unlocked session (passphrase known)           | A URL whose fragment encodes the passphrase (`#key=...`), plus a QR of that URL | N/A                                                                |
| Decode identity               | URL fragment with valid `#key=...`            | The exact original passphrase recovered                                         | Malformed/absent fragment → typed "no/invalid identity"            |
| Auto-unlock on load           | App loads with a valid identity fragment      | Vault unlocks with no passphrase prompt; fragment scrubbed from URL             | Wrong key for stored vault → falls back to manual unlock; no crash |
| Auto-unlock, no vault present | Valid fragment but no stored envelope         | Session unlocks to an empty vault (per 4.2); fragment scrubbed                  | No error                                                           |
| No fragment on load           | Normal load, no `#key=`                       | App behaves exactly as today (manual unlock available)                          | N/A                                                                |
| Generate while locked         | Session not unlocked                          | Control unavailable / prompts to unlock first                                   | No identity produced                                               |
| QR render                     | A link string                                 | A QR encoding the link is rendered locally (offline) with a text alternative    | Render failure → link still shown; message, no crash               |
| Security warning              | Portable-identity control shown               | Clear warning that anyone with the link/QR can unlock the vault                 | N/A                                                                |
| No-network property           | Any generate/render/decode/auto-unlock action | Zero network requests carrying key material                                     | Verified by test / documented threat note                          |

</intent-contract>

## Code Map

- `archer/lib/vault/portable-identity.ts` -- NEW. Pure module: `encodeIdentity(passphrase)` → a URL-safe fragment value and/or full link (`${origin}${pathname}#key=<encoded>`); `parseIdentityFromHash(hash)` → typed `{ passphrase }` or a typed "none/invalid" result; a small `KEY_PARAM` constant. Reversible encoding (URL-safe base64 or `encodeURIComponent`); no crypto, no network, no React. Includes a documented threat note in the file header explaining why the fragment never reaches a server.
- `archer/lib/vault/portable-identity.test.ts` -- NEW. Round-trip (`decode(encode(x)) === x`) across varied passphrases (unicode, symbols, long); malformed/absent fragment → typed none/invalid; a no-network assertion (stub `fetch`, expect zero calls); assertion that the produced link carries the key only after `#` (never before it).
- `archer/lib/vault/useVaultSession.ts` -- EDIT. Add `unlockWithPassphrase`/auto-unlock support if needed (the existing `unlock(passphrase)` already suffices) and an `identityLink()` helper that returns the encoded link when unlocked. Passphrase stays in memory only; nothing persisted.
- `archer/lib/vault/useVaultSession.test.ts` -- EDIT. Add: `identityLink` returns a link only when unlocked; encode/decode round-trips through the session passphrase to a successful `unlock`.
- `archer/app/page.tsx` -- EDIT. On mount, read `window.location.hash`; if a portable-identity key is present, call `session.unlock(decodedPassphrase)`, open the saved view (or auto-open), and scrub the fragment via `history.replaceState`. Pass an `onGenerateIdentity`/`identityLink` prop to `SavedBreakdowns`. Guard for SSR/prerender (`typeof window`).
- `archer/app/page.test.tsx` -- EDIT. Add: loading with a valid `#key=` fragment auto-unlocks (no passphrase typed) and scrubs the hash; loading without it behaves as today; a wrong-key fragment falls back to the manual unlock form.
- `archer/components/SavedBreakdowns.tsx` -- EDIT. Add a "Portable identity" section (only when unlocked) with: an explicit security warning (FR29), a control to reveal/copy the link, and a locally-rendered QR (with a text alternative) of the link. Reuse 4.3/4.4 button/token conventions and the existing clipboard utility for copy. No key logic in the component beyond receiving the link string.
- `archer/components/SavedBreakdowns.test.tsx` -- EDIT. Add: the security warning is shown before the link/QR; generating reveals the link; the QR has an accessible text alternative; copy uses the clipboard utility.
- `archer/components/SavedBreakdowns.a11y.test.tsx` -- EDIT. Extend axe/keyboard coverage to the portable-identity controls and QR alt text.
- `archer/lib/utils/clipboard.ts` -- REFERENCE ONLY. Reuse for copying the link (same pattern as ActionBar's copy).
- `archer/lib/vault/encrypted-storage.ts` / `crypto.ts` / `types.ts` -- REFERENCE ONLY. Auto-unlock reuses `listEntriesEncrypted(passphrase)`; no changes.
- `archer/package.json` -- EDIT IF NEEDED. If a QR-rendering library is used, add it as an exact-pinned dependency (client-side, offline, no crypto/network). If the QR can be rendered without a dependency, do not add one.
- `archer/vitest.setup.ts` / `archer/vitest.config.ts` -- REFERENCE. jsdom provides `window.location`/`history`; `@/` alias → project root.

## Tasks & Acceptance

**Execution:**

- `archer/lib/vault/portable-identity.ts` -- Implement reversible `encodeIdentity`/`parseIdentityFromHash` carrying the passphrase only in the URL fragment, with a threat-note header -- the pure portability core (FR27/FR28/NFR8).
- `archer/lib/vault/portable-identity.test.ts` -- Round-trip, malformed/absent, key-only-after-`#`, and no-network tests -- proves lossless, server-free key carriage.
- `archer/lib/vault/useVaultSession.ts` / `.test.ts` -- Add `identityLink()` (link only when unlocked) and test encode→decode→`unlock` round-trip -- the session seam.
- `archer/components/SavedBreakdowns.tsx` / `.test.tsx` / `.a11y.test.tsx` -- Add the warned, accessible portable-identity section (link + locally-rendered QR with alt text, copy via clipboard util) -- delivers FR27/FR29 + NFR10.
- `archer/app/page.tsx` / `.test.tsx` -- Auto-unlock from a load-time fragment and scrub it; wire the generate/link prop -- delivers FR28.
- `archer/package.json` -- Add an exact-pinned client-side QR library only if a dependency-free local render is impractical -- keeps QR rendering offline.

**Acceptance Criteria:**

- Given an encrypted vault and an unlocked session, when a portable identity is generated, then the app produces a saveable link and a locally-rendered QR that encode the unlock key material, and no account, passphrase prompt, or server-side record is created (FR27, FR28, NFR8).
- Given a portable-identity link or QR, when Archer is opened with it on another device that has the vault present/imported, then the vault is unlocked without a manual passphrase prompt (FR28).
- Given the portable-identity control is shown or about to be copied, when it is displayed, then a clear security warning states that anyone with the link/QR can unlock the vault and it should be stored securely (FR29).
- Given the portable-identity encoding, when inspected, then the key material is carried only in the URL fragment / locally-rendered QR and is never placed in a request to any Archer-owned server, verified by test (fragment-only + zero-network) and a documented threat note (FR28, NFR8).
- Given the portable-identity UI, when audited with axe-core and exercised by keyboard only, then it meets WCAG 2.1 AA including a meaningful text alternative for the QR (NFR10).

## Spec Change Log

_None._

## Review Triage Log

### 2026-08-31 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 2, low 1)
- defer: 3: (high 0, medium 1, low 2)
- reject: 8: (high 0, medium 0, low 8)
- addressed_findings:
  - `[medium]` `[patch]` Auto-unlock scrubbed the `#key=` fragment AFTER awaiting the deliberately-slow PBKDF2 unlock, so the plaintext key sat in the address bar/history for the whole derivation; the async IIFE also had no try/catch, so an unexpected throw could leave the fragment unscrubbed as an unhandled rejection. Fixed by scrubbing the fragment synchronously BEFORE the unlock and wrapping the unlock in try/catch/finally. Added a test (never-resolving unlock) asserting the hash is already scrubbed while the unlock is still in flight.
  - `[medium]` `[patch]` The NFR8 "no network" property was asserted only around the pure encode/decode functions (which never network), not around the user-facing auto-unlock path. Added a page-level test stubbing `fetch` and asserting zero calls during auto-unlock.
  - `[low]` `[patch]` The FR29 security warning was asserted only "before reveal"; the intent also says "about to be copied". Added a test asserting the warning remains visible alongside the Copy-link control after reveal.
  - `[low]` `[patch]` (fold) Fixed a `react-hooks/set-state-in-effect` lint error introduced while reordering the scrub, by moving `setShowSaved(true)` into the async callback's `finally`.

## Design Notes

Why the URL fragment: the fragment (`#...`) is never included in the HTTP request a browser sends, so a key placed there stays on the device — the standard "capability URL in the fragment" pattern (also used by password managers and E2E-encrypted apps). This directly satisfies "not sent to any Archer-owned server" without needing any server cooperation.

```ts
// portable-identity.ts (illustrative)
export const KEY_PARAM = "key";
export function encodeIdentity(
  passphrase: string,
  base = location.origin + location.pathname,
) {
  return `${base}#${KEY_PARAM}=${encodeURIComponent(passphrase)}`;
}
export function parseIdentityFromHash(
  hash: string,
): VaultResult<{ passphrase: string }> {
  const m = new URLSearchParams(hash.replace(/^#/, "")).get(KEY_PARAM);
  return m
    ? { success: true, data: { passphrase: decodeURIComponent(m) } }
    : { success: false, reason: "unknown" };
}
```

Auto-unlock reuses the settled model: the passphrase IS the key material (it derives the AES-GCM key via PBKDF2 in 4.2), so "unlock without a prompt" is simply feeding the decoded passphrase into the existing `session.unlock(...)`. After a successful (or attempted) auto-unlock, scrub the fragment with `history.replaceState` so the key does not linger in the address bar or browser history. A wrong key for the locally-stored vault decrypts nothing (per 4.2 `reason: "decrypt"`) and falls back to the manual unlock form — no crash, no partial data.

QR rendering: render the QR locally from the link string. Prefer a dependency-free canvas/SVG render; if that is impractical, add a single well-known, exact-pinned QR library used only for offline rendering (it never touches the key beyond drawing it, and makes no network call) — mirroring how `react-markdown` was adopted for rendering. The QR is decorative-plus-informative, so it carries a text alternative describing it as the vault unlock code.

## Verification

**Commands:**

- `npm test -- --run` (in `archer/`) -- expected: all portable-identity, session, SavedBreakdowns, a11y, and page tests pass, including encode/decode round-trip, auto-unlock-from-fragment, hash scrub, wrong-key fallback, and no-network.
- `npx tsc --noEmit` (in `archer/`) -- expected: no type errors.
- `npm run lint` (in `archer/`) -- expected: clean.
- `npm run build` (in `archer/`) -- expected: static export succeeds (confirms no server dependency introduced).

**Manual checks:**

- With an unlocked vault, open the portable-identity control: confirm the security warning is shown, a link and a QR appear, and copying the link works. Open the link in a fresh tab/profile that has the vault present: confirm the vault unlocks with no passphrase prompt and the `#key=...` disappears from the address bar. In devtools, confirm no network request carries the key. Open a link with a wrong key: confirm it falls back to the manual unlock form without crashing.

## Auto Run Result

Status: done

### Summary

Delivered portable passwordless identity for Story 4.5. A pure `lib/vault/portable-identity.ts` encodes the vault's unlock key material (the session passphrase — which derives the AES key in 4.2) into a URL fragment (`#key=...`), a location browsers never transmit to a server (NFR8), and decodes it back losslessly; the file header documents the threat note. The saved-breakdowns view gained a "Portable identity" section (unlocked-only) with an up-front security warning (FR29), a reveal-then-copy link, and a locally-rendered SVG QR of that link (offline, via exact-pinned `qrcode@1.5.4`, with a meaningful text alternative). On load, a present `#key=` fragment auto-unlocks the vault with no manual passphrase prompt (FR28) and the fragment is scrubbed from the URL/history before the unlock runs; a wrong key falls back to the manual unlock form with no crash.

### Files Changed

- `archer/lib/vault/portable-identity.ts` — NEW. Pure `encodeIdentity`/`encodeIdentityFragment`/`parseIdentityFromHash` (fragment-only, reversible, SSR-guarded, typed results, threat-note header).
- `archer/lib/vault/portable-identity.test.ts` — NEW. Round-trip across unicode/symbols/long/edge passphrases, malformed/absent → typed none, key-only-after-`#`, no-network.
- `archer/lib/vault/useVaultSession.ts` / `.test.ts` — EDIT. Added `identityLink()` (link only when unlocked); tests for null-when-locked and encode→decode→unlock round-trip.
- `archer/components/SavedBreakdowns.tsx` / `.test.tsx` / `.a11y.test.tsx` — EDIT. Portable-identity section: warning, reveal, copy (clipboard util), locally-rendered QR with alt text; interaction + warning-at-copy + axe/keyboard tests.
- `archer/app/page.tsx` / `.test.tsx` — EDIT. On-mount auto-unlock from a `#key=` fragment with scrub-before-unlock and try/catch; wired `identityLink`; tests for auto-unlock+scrub, scrub-before-resolve, no-network during auto-unlock, no-fragment inert, wrong-key fallback.
- `archer/package.json` — EDIT. Added exact-pinned `qrcode@1.5.4` (client-side/offline QR rendering, no crypto/network) + `@types/qrcode@1.5.6` (dev).

### Review Findings Breakdown

- Patches applied: 3 (2 medium, 1 low; plus a folded lint fix) — scrub the fragment before the async unlock + wrap it in try/catch; assert no network during auto-unlock; pin the security warning as visible alongside the Copy control.
- Deferred: 3 (1 medium, 2 low) — bound the on-screen lifetime of the revealed key + wire `lock()` to the UI; decode-side QR content assertion; harden the qrcode CJS/ESM interop against module-load throw.
- Rejected: 8 (all low) — spec's illustrative double-decode snippet (shipped code is correct); `encodeIdentityFragment` "unused" (used by tests); force-opening the saved view on a wrong key (deliberate); no-vault-on-second-device (R2a precondition; 4.2 reads absent envelope as empty); QR-as-input entry vector (resolves to the same hash by construction); `dangerouslySetInnerHTML` of the locally-generated SVG (not user HTML); and other by-design notes.

### Follow-up Review

`followup_review_recommended: true`. Patched findings this pass: 0 high, 2 medium, 1 low. Score = 3×2 + 1×1 = 7 ≥ 5 → true.

### Verification Performed

- `npm test -- --run` (archer/) — 25 files, 368 tests pass (was 336 after 4.4; +32).
- `npx tsc --noEmit` — no type errors.
- `npm run lint` — clean (fixed a `react-hooks/set-state-in-effect` introduced during patching).
- `npm run build` — succeeds; `/` prerendered static, only `/api/generate` dynamic — the new client-only QR dependency introduced no server dependency and the SSR/prerender guards hold.
- Matrix Test Audit — every I/O & Edge-Case Matrix row is covered by a test that ran and passed.

### Residual Risks

- The revealed link/QR (key material) has no bounded on-screen lifetime and `lock()` is not wired to the UI (deferred, medium) — a screenshot/shoulder-surf exposure window while the view is open.
- The QR is verified to render with an accessible alternative but its encoded payload is not decoded-and-asserted (deferred, low); it is generated by the trusted `qrcode` lib from the exact link string.
- Full WCAG 2.1 AA still needs manual assistive-technology testing; automated coverage is axe-core + keyboard. The spec's real-browser manual checks (cross-device unlock, devtools no-network) were not executed here; the no-network property is covered by tests and the documented threat note.
