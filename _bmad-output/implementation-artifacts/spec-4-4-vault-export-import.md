---
title: "Vault Export & Import"
type: "feature"
created: "2026-08-31"
status: "done"
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: "87e2f17b7d96528b0f72687c7edb095ac3bd0105"
context: []
warnings: []
deferred:
  - summary: >-
      Warn/confirm before a destructive replace of a non-empty vault, and guard
      the case where an unlocked session imports a file its passphrase cannot
      open (replace overwrites the currently-unlockable vault with an
      undecryptable one).
    evidence: |-
      Edge-case + blind-hunter: importVault falls through to "replace" whenever
      the session passphrase does not decrypt the imported envelope, silently
      overwriting an unlockable vault with one the current passphrase can't open
      (test "replaces (not merges) when the session passphrase differs" asserts
      this). Replace-as-default is the spec's sanctioned design and the outcome
      is disclosed as "replaced", but a destructive-replace confirmation (like
      the Clear-vault modal) would prevent accidental lockout/data loss.
    location: >-
      archer/lib/vault/transfer.ts (importVault), archer/components/SavedBreakdowns.tsx
    severity: medium
  - summary: >-
      Add a file-size guard before reading an imported file into memory.
    evidence: |-
      Edge-case + blind-hunter: handleImportFile calls file.text() with no size
      cap, so a very large/binary file is read whole and JSON.parse'd, which can
      freeze or OOM the tab. Same hardening class as other deferred limits.
    location: >-
      archer/components/SavedBreakdowns.tsx (handleImportFile)
    severity: low
  - summary: >-
      Add busy/disabled state and a concurrency guard across Export/Import (and
      the other async saved-view actions) to prevent overlapping operations.
    evidence: |-
      Edge-case + blind-hunter: Export/Import buttons have no shared busy lock,
      so rapid or concurrent clicks can race on the envelope read/write. Same
      class as the async-action pending-state item already deferred for 4.3.
    location: >-
      archer/components/SavedBreakdowns.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** The encrypted vault (4.2) and its saved-breakdowns UI (4.3) live only in this browser's `localStorage`. A user who owns their data has no way to back it up or move it to another browser/device — there is no export to a file and no import back (FR25, FR26).

**Approach:** Add a pure `lib/vault/transfer.ts` module that exports the whole encrypted vault envelope to a single downloadable file (reusing the existing client-side download pattern, no server round-trip) and imports a previously exported file back into `localStorage`. Import validates the file is a well-formed encrypted envelope and either replaces the current vault or, when an unlocked session can decrypt both, merges their entries — telling the user which happened. A corrupt or invalid file is rejected with a clear error and no partial import. Surface both actions in the existing `SavedBreakdowns` view.

## Boundaries & Constraints

**Always:**

- Run entirely client-side. Export/import make no network request of any kind (NFR8); export reuses the existing Blob→object-URL→anchor→revoke download pattern (via `lib/utils/download.ts` or an equivalent that mirrors it exactly).
- Export the encrypted vault as the stored envelope (`archer.vault.enc.v1`) verbatim — the exported file's payload is ciphertext, never plaintext goal content (preserves FR22 for the exported artifact).
- Keep export/import logic in `lib/vault/`, free of React; components only orchestrate and render (AR4/AR6). Return typed `VaultResult`-style results; never throw across the module boundary.
- Import must validate structure before writing: only a value that parses and matches the `EncryptedVaultEnvelope` shape (base64 `salt`/`iv`/`ciphertext`) is accepted. Anything else is rejected with a typed failure and the current stored vault is left completely untouched (no partial import).
- Report the import outcome to the user as either "merged" or "replaced": merge only when an unlocked session's passphrase decrypts BOTH the current and imported envelopes (union their entries, dedupe by entry `id`, re-encrypt under the session passphrase); otherwise replace the stored envelope wholesale.
- On merge, preserve every entry from both sides; identical `id`s collapse to one (imported copy wins on conflict). On replace, the imported envelope becomes the stored vault exactly.
- Reuse `lib/vault/encrypted-storage.ts` / `crypto.ts` for any decrypt/re-encrypt during merge; do not re-implement crypto or the envelope shape.
- All new UI meets WCAG 2.1 AA consistent with 4.3 controls: keyboard operable, correct ARIA/labels, ≥44×44px targets, contrast via existing tokens, reduced-motion respected (NFR10).

**Block If:**

- The `EncryptedVaultEnvelope` type or `encrypted-storage.ts`/`crypto.ts` API must change to support export/import (e.g. the stored envelope cannot be read/written as-is). The 4.2 shape is settled; if a real schema change is required, HALT with blocking condition `vault schema change required`.
- Satisfying "merged vs replaced" needs a product decision not derivable from the epic (e.g. how to reconcile two envelopes encrypted under DIFFERENT passphrases beyond the replace fallback). If the intent cannot be met without inventing such a policy, HALT with blocking condition `merge policy undefined`.

**Never:**

- No new server-side storage, API route, or network transmission (NFR8).
- No third-party dependency for file read/write, crypto, or archive formats.
- No exporting plaintext or decrypted entries to the file; the exported payload stays the encrypted envelope.
- No change to `crypto.ts` primitives or the persisted envelope/schema in `types.ts`.
- No portable link/QR identity (Story 4.5).
- No writing any part of an invalid/corrupt import to storage.

## I/O & Edge-Case Matrix

| Scenario                    | Input / State                                                          | Expected Output / Behavior                                                                               | Error Handling                                            |
| --------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Export populated vault      | Envelope present under `archer.vault.enc.v1`                           | Downloads one file whose JSON payload is the encrypted envelope (ciphertext); `{ success: true }`        | Download API unavailable → typed failure; nothing changes |
| Export empty vault          | No envelope stored                                                     | Typed "nothing to export" result / disabled affordance; no file with plaintext                           | No throw; clear message                                   |
| Import valid file (replace) | Well-formed envelope file, no unlocked session (or passphrases differ) | Stored envelope replaced by imported one; user told "replaced"; `{ success: true }`                      | N/A                                                       |
| Import valid file (merge)   | Well-formed envelope file, unlocked session decrypts both              | Entries unioned (dedupe by id, imported wins); re-encrypted under session passphrase; user told "merged" | Decrypt-mismatch → fall back to replace, told "replaced"  |
| Import invalid JSON         | File is not JSON                                                       | Rejected; clear error; stored vault untouched                                                            | Parse error caught; no partial write                      |
| Import wrong shape          | JSON present but missing/invalid `salt`/`iv`/`ciphertext`              | Rejected; clear error; stored vault untouched                                                            | Shape guard fails; no write                               |
| Import empty/oversized file | Empty file or non-text                                                 | Rejected with clear error                                                                                | Read error caught; no write                               |
| Export→import round-trip    | Export then import into a fresh vault                                  | All entries recoverable after unlock; count/content preserved                                            | N/A                                                       |
| Storage unavailable         | `localStorage` absent/throws                                           | Import/export fail gracefully with a message                                                             | Typed `unavailable`; never throws                         |

</intent-contract>

## Code Map

- `archer/lib/vault/transfer.ts` -- NEW. Pure export/import core. `exportVault()` reads the raw envelope string from `localStorage["archer.vault.enc.v1"]` and triggers a download of a single JSON file (via `downloadMarkdown`-style Blob/object-URL flow or a shared helper), returning a typed result; refuses to export when no envelope exists. `importVault(fileText, session?)` parses + validates the `EncryptedVaultEnvelope` shape, then either merges (when a passphrase decrypts both) or replaces, returning `{ success: true, data: { outcome: "merged" | "replaced", count } }` or a typed failure — never writing on invalid input.
- `archer/lib/vault/transfer.test.ts` -- NEW. Unit-test every I/O & Edge-Case Matrix row: export populated/empty, import replace, import merge (dedupe by id), invalid JSON, wrong shape, empty file, export→import round-trip (entries preserved after unlock), storage unavailable, and a no-network assertion (stub `fetch`, expect zero calls).
- `archer/lib/vault/encrypted-storage.ts` -- REFERENCE/EDIT-IF-NEEDED. Source of `ENCRYPTED_VAULT_KEY` and the read/write envelope + decrypt/encrypt helpers. Prefer reusing its exported surface; if a tiny read-raw/write-raw helper is genuinely required for transfer, add it here (not a new storage path) rather than duplicating `getStorage()`/envelope logic. Do not change existing behavior or the envelope shape.
- `archer/lib/vault/crypto.ts` -- REFERENCE ONLY. Decrypt/encrypt + base64 codecs reused for merge. No changes.
- `archer/lib/vault/types.ts` -- REFERENCE ONLY. `EncryptedVaultEnvelope`, `VaultEntry`, `VaultResult`, `VaultFailureReason`. Import validation checks the envelope shape; no type changes.
- `archer/lib/vault/useVaultSession.ts` -- EDIT. Add thin `exportVault`/`importVault` wrappers so the component calls the session, and refresh the in-memory `entries` list after a successful import (merge or replace) when unlocked. Passphrase stays in memory only.
- `archer/lib/vault/useVaultSession.test.ts` -- EDIT. Add cases: export delegates to transfer; import replace/merge updates the session list; invalid import surfaces a typed failure and leaves entries unchanged.
- `archer/components/SavedBreakdowns.tsx` -- EDIT. Add an "Export vault" button (downloads the file) and an "Import vault" file input/button that reads the chosen file's text and calls the import handler, then shows a clear "merged"/"replaced" or error message via the existing `role="alert"`/status pattern. Reuse the 4.3 button/token conventions (44×44px, focus rings). No storage logic in the component.
- `archer/components/SavedBreakdowns.test.tsx` -- EDIT. Add: export triggers the export handler; importing a valid file shows the outcome message; importing an invalid file shows a rejection and calls no write; the file input is labeled/keyboard-operable.
- `archer/components/SavedBreakdowns.a11y.test.tsx` -- EDIT. Extend axe/keyboard coverage to the export/import controls.
- `archer/app/page.tsx` -- EDIT. Wire `onExport`/`onImport` handlers (mapping typed results to plain messages) into `SavedBreakdowns`, mirroring the existing `onUnlock`/`onDelete`/`onClear` prop pattern.
- `archer/app/page.test.tsx` -- EDIT. Add an integration case: import from the saved view surfaces the outcome and refreshes the list.
- `archer/lib/utils/download.ts` -- REFERENCE ONLY. The canonical Blob→object-URL→anchor→revoke pattern to reuse for the export download. If the file type differs (JSON vs markdown), either pass a type or add a sibling helper mirroring it; do not hand-roll a divergent flow.
- `archer/vitest.setup.ts` / `archer/vitest.config.ts` -- REFERENCE. jsdom provides `localStorage`, `crypto.subtle`, `URL.createObjectURL` is stubbed per-test in the existing download tests; `@/` alias → project root.

## Tasks & Acceptance

**Execution:**

- `archer/lib/vault/transfer.ts` -- Implement `exportVault` (download the raw encrypted envelope, refuse when empty) and `importVault(fileText, session?)` (validate envelope shape; merge when a passphrase decrypts both, else replace; never write on invalid input) returning typed results -- the pure export/import core (FR25/FR26).
- `archer/lib/vault/transfer.test.ts` -- Unit-test every I/O & Edge-Case Matrix row including the export→import round-trip and no-network assertion -- proves ownership/back-up behavior and safe rejection.
- `archer/lib/vault/useVaultSession.ts` -- Add `exportVault`/`importVault` session wrappers that refresh `entries` after a successful import -- gives the UI a storage-free seam.
- `archer/lib/vault/useVaultSession.test.ts` -- Test export delegation, import replace/merge list-refresh, and invalid-import no-op -- guards the seam.
- `archer/components/SavedBreakdowns.tsx` -- Add accessible Export + Import controls that call the handlers and render "merged"/"replaced"/error messages -- delivers the user-facing surface (FR25/FR26, NFR10).
- `archer/components/SavedBreakdowns.test.tsx` / `SavedBreakdowns.a11y.test.tsx` -- Test export/import interactions, outcome/rejection messaging, and axe/keyboard operability -- proves the AC + NFR10.
- `archer/app/page.tsx` / `archer/app/page.test.tsx` -- Wire and integration-test the export/import handlers through the saved view -- completes the live wiring.

**Acceptance Criteria:**

- Given a populated vault, when export runs, then a single file is downloaded whose payload is the encrypted vault envelope, produced entirely client-side with no network request (FR25, NFR8).
- Given a previously exported file, when imported, then its entries are restored into the local vault and the user is told whether they were merged with or replaced the current vault (FR26).
- Given an invalid or corrupt file, when imported, then it is rejected with a clear error and the existing stored vault is left byte-for-byte unchanged (no partial import).
- Given the export/import logic, when inspected, then it is covered by tests including an export→import round-trip that preserves all entries, and neither the transfer module nor its tests make a network request.
- Given the export/import UI, when audited with axe-core and exercised by keyboard only, then it meets WCAG 2.1 AA (roles/labels, ≥44×44px targets, keyboard operability, reduced motion) (NFR10).

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
  - `[medium]` `[patch]` The `handleImport` "replaced" message branch (and the singular/plural `count` wording) was never asserted through the real page handler — only the "merged" branch was — so inverting or garbling the replaced copy would pass all tests while AC2 requires the user to be told merged-vs-replaced. Added page tests asserting the "replaced" message (and that "merged" does not appear) and the singular "1 saved breakdown total" wording.
  - `[medium]` `[patch]` `handleImport` mapped every failure to "isn't a valid vault export", so a `quota`/`unavailable` storage failure was mislabeled as a corrupt file. Fixed by branching on `reason` to show storage-full / storage-unavailable messages (still stating the existing vault is unchanged) and added a page test asserting a full-store import shows the storage message, not the invalid-file message.
  - `[low]` `[patch]` `exportVault`'s comment claimed it distinguishes absent-storage from empty-vault, which the code does not. Corrected the comment to describe the actual behavior (both surface as `unavailable`).

## Design Notes

Export is trivial and safe because the stored value is already ciphertext: read `localStorage[ENCRYPTED_VAULT_KEY]` and download it as-is (e.g. `archer-vault.json`). No decryption, no passphrase, no plaintext ever hits the file.

Merge vs replace (the one non-obvious decision):

```ts
// importVault(fileText, session?)
// 1. JSON.parse + isEnvelope guard → reject if malformed (no write).
// 2. If session unlocked AND both current+imported decrypt with its passphrase:
//    union entries by id (imported wins on conflict), re-encrypt, write → "merged".
// 3. Else: write imported envelope verbatim → "replaced".
```

Replace is the safe default and always available; merge is the enhancement that requires a shared, in-memory passphrase. Reconciling two DIFFERENT-passphrase vaults beyond "replace" is intentionally out of scope (the `merge policy undefined` block guards against inventing more). Rejection-before-write is the invariant that guarantees "no partial import": validate the whole envelope shape first, and only then touch storage.

## Verification

**Commands:**

- `npm test -- --run` (in `archer/`) -- expected: all transfer, session, SavedBreakdowns, a11y, and page tests pass, including export→import round-trip, invalid-file rejection, merge dedupe, and no-network.
- `npx tsc --noEmit` (in `archer/`) -- expected: no type errors.
- `npm run lint` (in `archer/`) -- expected: clean.
- `npm run build` (in `archer/`) -- expected: static export succeeds (confirms no server dependency introduced).

**Manual checks:**

- With a populated vault, click Export and confirm a single JSON file downloads whose content is the ciphertext envelope (no readable goal text). In a fresh browser profile, Import that file, unlock, and confirm all entries reappear ("replaced"); with an unlocked matching-passphrase vault, Import and confirm "merged" with no duplicates. Import a hand-corrupted file and confirm a clear rejection with the existing vault intact. Observe no network request during any action.

## Auto Run Result

Status: done

### Summary

Delivered vault export/import for Story 4.4 as a pure, React-free `lib/vault/transfer.ts` core plus UI wiring. `exportVault()` downloads the stored encrypted envelope verbatim (ciphertext, never plaintext) as a single `archer-vault.json` file via a `downloadJson` sibling of the existing download utility — entirely client-side, no network. `importVault(fileText, session?)` validates the `EncryptedVaultEnvelope` shape before touching storage (guaranteeing no partial import), then merges when an unlocked session's passphrase decrypts BOTH the current and imported envelopes (union entries by id, imported wins, re-encrypt) or replaces the stored envelope wholesale, reporting `{ outcome, count }`. `SavedBreakdowns` gained accessible Export/Import controls with merged/replaced/error messaging, and `page.tsx` wires the handlers, now distinguishing storage failures from invalid files.

### Files Changed

- `archer/lib/vault/transfer.ts` — NEW. Pure export/import core (validate-before-write, merge-or-replace, typed results).
- `archer/lib/vault/transfer.test.ts` — NEW. Every I/O matrix row: export populated/empty, replace, merge/dedupe, invalid JSON/shape/empty, export→import round-trip, storage unavailable, no-network.
- `archer/lib/vault/encrypted-storage.ts` — EDIT. Added transfer helpers (`readRawEnvelopeString`, `writeRawEnvelope`, `decryptEnvelope`, `encryptVaultToEnvelope`, `readStoredEnvelope`, `isEncryptedVaultEnvelope`) reusing the same key/shape/crypto; existing behavior unchanged.
- `archer/lib/vault/useVaultSession.ts` / `.test.ts` — EDIT. `exportVault`/`importVault` session wrappers refreshing entries on success; tests for delegation, merge/replace refresh, invalid no-op.
- `archer/components/SavedBreakdowns.tsx` / `.test.tsx` / `.a11y.test.tsx` — EDIT. Accessible Export/Import controls (labeled hidden file input + ≥44px buttons), transfer status/alert messaging; interaction + axe/keyboard tests.
- `archer/app/page.tsx` / `.test.tsx` — EDIT. Wired `onExport`/`onImport`; reason-aware failure messaging; integration tests for merged/replaced/singular-count/storage-failure surfaces.
- `archer/lib/utils/download.ts` — EDIT. Added `downloadJson` mirroring `downloadMarkdown` with `application/json`.

### Review Findings Breakdown

- Patches applied: 3 (2 medium, 1 low) — pinned the "replaced" import message + singular count through the real page handler; distinguished quota/unavailable storage failures from invalid-file in `handleImport`; corrected a misleading `exportVault` comment.
- Deferred: 3 (1 medium, 2 low) — confirm/guard before a destructive replace (incl. importing a file the current passphrase can't open); file-size guard before reading an import; busy/concurrency guard across Export/Import (same class as the 4.3 async deferral).
- Rejected: 8 (all low) — merge "imported wins" ignoring createdAt (UUID ids make cross-vault collision implausible; self-import is a correct no-op); schemaVersion-mismatch handling (version is fixed at 1); downloadJson duplication (intentional sibling per spec); count=0 on locked replace (correct — ciphertext can't be counted without the passphrase); and other by-design/cosmetic notes.

### Follow-up Review

`followup_review_recommended: true`. Patched findings this pass: 0 high, 2 medium, 1 low. Score = 3×2 + 1×1 = 7 ≥ 5 → true.

### Verification Performed

- `npm test -- --run` (archer/) — 24 files, 336 tests pass (was 307 after 4.3; +29), including export→import round-trip, invalid-file rejection with storage byte-for-byte unchanged, merge dedupe, no-network (fetch spy zero calls), and the new replaced/singular/storage-failure page assertions.
- `npx tsc --noEmit` — no type errors.
- `npm run lint` — clean.
- `npm run build` — static export succeeds; only `/api/generate` dynamic — no server dependency introduced.
- Matrix Test Audit — every I/O & Edge-Case Matrix row is covered by a test that ran and passed.

### Residual Risks

- Import "replace" is destructive and unconfirmed: an unlocked user importing a file their passphrase cannot open replaces (and effectively locks out) their current vault, disclosed only as "replaced" (deferred, medium). Adding a confirmation mirrors the existing Clear-vault modal.
- Full WCAG 2.1 AA still needs manual assistive-technology testing; automated coverage is axe-core + keyboard only.
- The spec's real-browser manual checks (actual file download in a fresh profile, devtools no-network observation, hand-corrupted file rejection) were not executed; the automated no-network assertion and static build cover the equivalents.
