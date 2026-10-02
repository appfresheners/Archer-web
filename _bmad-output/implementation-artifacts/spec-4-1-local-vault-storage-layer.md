---
title: "Local Vault Storage Layer"
type: "feature"
created: "2026-08-31"
status: "done"
review_loop_iteration: 0
baseline_commit: "47fe3c4d27bcb89b6ac5be0bdbf1fc7336ac6189"
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Archer holds no state between sessions — `page.tsx` uses `useState` only, so refreshing or closing the tab loses every generated breakdown. Users cannot revisit work they created moments ago.

**Approach:** Introduce the first persistence layer as an isolated, pure `lib/vault/` module that saves each generated breakdown (input, mode, generation options, output markdown, timestamp) to browser storage behind a versioned schema, and wire `page.tsx` to save on successful generation. This story delivers the plaintext storage foundation only; encryption (4.2), the list/restore UI (4.3), and export/import (4.4) build on top of it.

## Boundaries & Constraints

**Always:**

- Run entirely client-side. No network request to any Archer-owned server for persistence (NFR8).
- Keep all storage logic in `lib/vault/`, isolated from React components. Components only orchestrate; the vault exposes pure create / read / list / delete functions (AR4/AR6 layering).
- Persist a versioned schema (a `schemaVersion` field) so the stored shape can evolve safely.
- Persist every field required by FR21: input text, mode, generation options, output markdown, and a creation timestamp — plus a stable unique id per entry.
- Handle storage-unavailable / quota-exceeded failures gracefully: surface a user-visible message and never destroy the on-screen output. Vault functions return a typed result, never throw across the module boundary.
- Match existing `lib/utils` conventions: `{ success: boolean }`-style typed results, colocated `*.test.ts`, `@/`-alias imports.

**Ask First:**

- Choosing IndexedDB over localStorage (this spec assumes localStorage; escalate before switching).
- Introducing any third-party storage or persistence dependency.

**Never:**

- No encryption in this story (that is Story 4.2 — but the schema and value shape must not block encryption being layered on later).
- No saved-breakdowns UI, restore flow, delete-from-UI, or clear-vault UI (Stories 4.3+). A programmatic `delete`/`clear` in the module is in scope; surfacing it in the UI is not.
- No server-side storage of any kind.
- No hand-rolled binary formats — store JSON.

## I/O & Edge-Case Matrix

| Scenario                   | Input / State                                          | Expected Output / Behavior                                                             | Error Handling                         |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------- |
| Save on generation success | A completed breakdown (input, mode, options, markdown) | New entry appended to vault with generated id + timestamp; `{ success: true }`         | N/A                                    |
| List entries               | Vault has N entries                                    | Array of entries returned; caller can order newest-first by timestamp                  | Returns `[]` if empty                  |
| Read single entry          | Valid entry id                                         | The matching entry                                                                     | Returns `null` if id not found         |
| Delete single entry        | Valid entry id                                         | Entry removed; `{ success: true }`                                                     | No-op `{ success: true }` if id absent |
| Storage unavailable        | `localStorage` throws / undefined                      | `{ success: false }`; on-screen output untouched; page shows a non-destructive message | Caught; never throws                   |
| Quota exceeded             | `setItem` throws `QuotaExceededError`                  | `{ success: false }` with a distinguishable reason                                     | Caught; user-visible message           |
| Corrupt stored JSON        | Vault key holds unparseable / wrong-shape data         | Treated as empty vault for reads; a fresh write does not crash                         | Caught; parse failure isolated         |

</frozen-after-approval>

## Code Map

- `archer/lib/vault/types.ts` -- NEW. `VaultEntry`, `VaultSchema` (with `schemaVersion`), `VaultResult<T>` types. `VaultEntry.generationOptions` typed as an open/optional record now (Epic 5 owns the concrete `GenerationOptions` type; keep the field name stable so 4.x/Epic 5 align).
- `archer/lib/vault/storage.ts` -- NEW. Pure functions: `saveEntry`, `listEntries`, `readEntry`, `deleteEntry`, `clearVault`. Wraps `localStorage` behind a single versioned key (e.g. `archer.vault.v1`). All reads tolerate missing/corrupt data; all writes catch quota/unavailable and return a typed failure. No React.
- `archer/lib/vault/storage.test.ts` -- NEW. Unit tests covering the I/O matrix (save/list/read/delete/clear, empty, not-found, corrupt JSON, unavailable, quota). Mock `localStorage` in jsdom.
- `archer/lib/utils/download.ts` -- REFERENCE ONLY. Establishes the `{ success: boolean }` typed-result convention and try/catch-around-browser-API pattern to mirror.
- `archer/app/page.tsx` -- EDIT. In `handleSubmit`, after `setOutput(data.markdown)` succeeds, call `saveEntry(...)`. On `{ success: false }`, set a non-blocking, dismissible save-failure notice (separate from `error`, which is for generation failures) so the visible output is never cleared.
- `archer/app/page.test.tsx` -- EDIT. Add cases: successful generation persists an entry; a save failure shows the save notice while keeping the output rendered.
- `archer/vitest.setup.ts` -- REFERENCE. jsdom provides `localStorage`; tests may spy/override it per case.
- `archer/tsconfig.json` / `archer/vitest.config.ts` -- REFERENCE. `@/` alias → project root; used by imports and tests.

## Tasks & Acceptance

**Execution:**

- [x] `archer/lib/vault/types.ts` -- Define `VaultEntry` (id, schemaVersion or carried on the container, inputText, mode, generationOptions, outputMarkdown, createdAt), the persisted `VaultSchema` container with `schemaVersion`, and a `VaultResult<T>` discriminated result -- gives every consumer a stable, encryption-ready shape.
- [x] `archer/lib/vault/storage.ts` -- Implement `saveEntry`, `listEntries`, `readEntry`, `deleteEntry`, `clearVault` over a single versioned localStorage key; generate ids (e.g. `crypto.randomUUID()`) and `createdAt` timestamps inside `saveEntry`; wrap every storage access in try/catch returning typed results; treat missing/corrupt data as an empty vault on read -- the isolated, testable persistence core.
- [x] `archer/lib/vault/storage.test.ts` -- Unit-test every I/O & Edge-Case Matrix row, including corrupt JSON, storage-unavailable, and quota-exceeded paths -- proves graceful failure and round-trip integrity.
- [x] `archer/app/page.tsx` -- Wire `saveEntry` into `handleSubmit` on generation success; add a distinct, dismissible save-failure notice that does not clear `output` -- delivers the user-facing persistence without touching the result.
- [x] `archer/app/page.test.tsx` -- Add tests: generation success writes a vault entry; simulated save failure surfaces the notice while output stays visible -- guards the integration contract.

**Acceptance Criteria:**

- Given a breakdown has been generated successfully, when generation completes, then a vault entry containing input text, mode, generation options, output markdown, and a creation timestamp is written client-side with no Archer-server network request (FR21, NFR8).
- Given the `lib/vault/` module, when inspected, then it exposes pure create/read/list/delete functions, persists via browser storage under a versioned schema, and imports no React (AR4/AR6).
- Given browser storage is unavailable or full, when a save is attempted, then the failure is handled gracefully with a user-visible message and the current on-screen output remains intact.
- Given the vault key holds corrupt or wrong-shaped data, when entries are read, then the module treats it as empty rather than throwing, and a subsequent save still succeeds.

## Design Notes

Persisted shape (illustrative, ~7 lines):

```ts
// archer/lib/vault/types.ts
export interface VaultEntry {
  id: string; // crypto.randomUUID()
  inputText: string;
  mode: "goal" | "project";
  generationOptions: Record<string, unknown> | null; // Epic 5 refines
  outputMarkdown: string;
  createdAt: number; // Date.now(), enables newest-first ordering
}
export interface VaultSchema {
  schemaVersion: 1;
  entries: VaultEntry[];
}
```

Rationale: a single versioned container keyed once in localStorage keeps the whole vault atomic to serialize/parse and trivial for Story 4.2 to wrap in encrypt/decrypt (encrypt the serialized container, not per-entry). Storing `generationOptions` as a nullable open record avoids a hard dependency on Epic 5 while locking the field name so the type can tighten later without a data migration.

## Verification

**Commands:**

- `npm test -- --run` (in `archer/`) -- expected: all vault + page tests pass, including corrupt/unavailable/quota cases.
- `npx tsc --noEmit` (in `archer/`) -- expected: no type errors.
- `npm run lint` (in `archer/`) -- expected: clean.
- `npm run build` (in `archer/`) -- expected: static export succeeds (confirms no server dependency introduced).

**Manual checks:**

- Generate a breakdown, refresh the page, then inspect `localStorage` in dev tools: the `archer.vault.v*` key holds the entry (plaintext is acceptable for this story; 4.2 encrypts it).

## Suggested Review Order

**Persistence core**

- Entry point: public API + save flow, id/timestamp generation, append-then-write.
  [`storage.ts:155`](../../archer/lib/vault/storage.ts#L155)

- Read tolerance — missing/corrupt/wrong-shape all collapse to an empty vault.
  [`storage.ts:52`](../../archer/lib/vault/storage.ts#L52)

- Write boundary — never throws; classifies quota vs unavailable vs unknown.
  [`storage.ts:112`](../../archer/lib/vault/storage.ts#L112)

- Quota classifier — QuotaExceededError, Firefox name, numeric codes 22/1014.
  [`storage.ts:90`](../../archer/lib/vault/storage.ts#L90)

- Robustness fix — id falls back when crypto.randomUUID is unavailable (insecure context).
  [`storage.ts:139`](../../archer/lib/vault/storage.ts#L139)

**UI binding**

- Save-on-success wiring; failure only raises a notice, never clears output.
  [`page.tsx:51`](../../archer/app/page.tsx#L51)

- Dismissible role="status" notice rendered above the output panel.
  [`page.tsx:136`](../../archer/app/page.tsx#L136)

**Types & tests**

- Persisted shape: VaultEntry, versioned VaultSchema, VaultResult discriminated union.
  [`types.ts:14`](../../archer/lib/vault/types.ts#L14)

- Storage unit tests — full I/O matrix incl. corrupt/unavailable/quota/no-network.
  [`storage.test.ts:1`](../../archer/lib/vault/storage.test.ts#L1)

- Page integration tests — persist on success, notice on failure, output preserved.
  [`page.test.tsx:648`](../../archer/app/page.test.tsx#L648)
