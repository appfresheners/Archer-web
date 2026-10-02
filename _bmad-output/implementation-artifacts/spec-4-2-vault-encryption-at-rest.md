---
title: "Vault Encryption at Rest"
type: "feature"
created: "2026-08-31"
status: "done"
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: "a48d1d2703eb622c4d0a9181eeab797d8c971810"
context: []
warnings: []
deferred:
  - summary: >-
      Wire the encrypted vault (encrypted-storage.ts) into the app's actual
      save path and add a passphrase-prompt / unlock UI so real saved data is
      ciphertext at rest and a user-facing "couldn't unlock" message renders.
    evidence: |-
      Intent-alignment audit: app/page.tsx still calls the plaintext saveEntry
      (storage.ts) on generation, so a dev-tools inspection of the running app
      today shows plaintext under archer.vault.v1. The encrypted layer and its
      typed reason:"decrypt" exist but are unused. Deferred to Story 4.3, which
      owns the saved-breakdowns view and unlock surface per the epic sequencing.
    location: >-
      archer/app/page.tsx
    severity: high
  - summary: >-
      Decide how the unlock UI distinguishes a wrong passphrase from a genuinely
      empty vault, and guard against a wrong-passphrase save silently overwriting
      the existing (correct-passphrase) ciphertext on a corrupt/empty read.
    evidence: |-
      readVault returns success+empty on missing/corrupt envelope; a wrong
      passphrase on an existing envelope returns reason:"decrypt" (no overwrite,
      tested). The perception-of-data-loss and re-save hardening (e.g. a
      verifier token) becomes user-observable only once the 4.3 unlock UI exists.
    location: >-
      archer/lib/vault/encrypted-storage.ts
    severity: medium
  - summary: >-
      Persist KDF parameters (iterations, hash, key length) in the encrypted
      envelope so raising PBKDF2 iterations later does not orphan existing vaults.
    evidence: |-
      Blind-hunter: envelope carries schemaVersion but hardcodes 210000/SHA-256
      on read via crypto.ts constants; a future increase leaves prior vaults
      undecryptable with no migration path. Needed before crypto params change.
    location: >-
      archer/lib/vault/types.ts (EncryptedVaultEnvelope)
    severity: medium
  - summary: >-
      Gate on envelope schemaVersion (and add a migration path) before treating
      stored encrypted data as the current version.
    evidence: |-
      isEnvelope only checks salt/iv/ciphertext are strings; a future/unknown
      schemaVersion is fed to decrypt and surfaces as a misleading empty vault.
      Mirrors the same deferred gap logged for 4.1 plaintext schema.
    location: >-
      archer/lib/vault/encrypted-storage.ts (isEnvelope/readEnvelope)
    severity: medium
  - summary: >-
      Add a KDF strength regression guard so lowering PBKDF2 iterations or
      changing the hash is caught by tests (NFR9 work factor is currently
      unpinned).
    evidence: |-
      Verification-gap: no test asserts the iteration count or SHA-256; lowering
      iterations to 1000 leaves every test green because both sides derive with
      the same weakened params. Pin the constant or spy on subtle.deriveKey args.
    location: >-
      archer/lib/vault/crypto.ts (PBKDF2_ITERATIONS)
    severity: medium
  - summary: >-
      Add multi-tab / concurrent-write safety for the encrypted vault
      (read-modify-write can clobber across tabs).
    evidence: |-
      Blind-hunter: saveEntryEncrypted does decrypt -> mutate -> encrypt -> write
      with no storage-event listener, locking, or optimistic version check; two
      tabs saving concurrently lose entries. Same class as the 4.1 deferred item.
    location: >-
      archer/lib/vault/encrypted-storage.ts
    severity: low
  - summary: >-
      Consider caching the derived CryptoKey across an operation to avoid running
      PBKDF2 (210k iterations) twice per save.
    evidence: |-
      Blind-hunter: saveEntryEncrypted -> readVault (derive) then writeVault
      (derive) derives the key twice; noticeable UI latency once wired into a
      real flow. Perf-only; no correctness impact.
    location: >-
      archer/lib/vault/encrypted-storage.ts
    severity: low
  - summary: >-
      Consider binding envelope metadata (schemaVersion, salt) as AES-GCM
      additional authenticated data (AAD) to detect tampering of those fields.
    evidence: |-
      Blind-hunter hardening note: envelope fields outside the ciphertext are
      not authenticated; an attacker with storage access could alter them,
      failing decrypt ambiguously. Defense-in-depth, not required by the ACs.
    location: >-
      archer/lib/vault/crypto.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 4.1 persists the vault as plaintext JSON under `localStorage["archer.vault.v1"]`, so anyone inspecting browser dev tools can read a user's goals, project text, and generated markdown verbatim. That violates FR22/NFR9 — the personal ambitions users type must not sit unencrypted on the device.

**Approach:** Add an isolated, pure `lib/vault/crypto.ts` module built only on the Web Crypto API (PBKDF2 key derivation + AES-GCM encryption, per-vault random salt, per-encryption random IV) and a passphrase-keyed encrypted storage API in `lib/vault/` that serializes the whole `VaultSchema` container, encrypts it, and stores the ciphertext bundle under a new versioned key. Decryption with the wrong passphrase fails cleanly with a typed "couldn't unlock" outcome and never surfaces partial or garbage data. This story delivers the encryption core and the encrypted storage layer only; the passphrase-prompt UI and unlock/list surface are Story 4.3's responsibility.

## Boundaries & Constraints

**Always:**

- Run entirely client-side. No network request of any kind (NFR8); crypto and storage are browser-local.
- Use only the browser-native Web Crypto API (`crypto.subtle`, `crypto.getRandomValues`). PBKDF2 to derive an AES-GCM key from a user passphrase; AES-GCM to encrypt/decrypt (NFR9).
- Derive the key with a per-vault random salt (generated once, stored alongside the ciphertext) and encrypt with a fresh random IV per write.
- Keep all crypto and storage logic in `lib/vault/`, free of React and free of any third-party crypto dependency (AR4/AR6, NFR9).
- Encrypt the serialized `VaultSchema` container as a whole (not per-entry), so `inputText`, `outputMarkdown`, `mode`, and `generationOptions` are all ciphertext at rest.
- Return typed results (`VaultResult<T>`) across the module boundary — encrypt/decrypt/storage functions never throw across the boundary; a wrong passphrase yields a typed `reason: "decrypt"` failure, never garbage.
- Match existing `lib/vault` conventions: discriminated `VaultResult`, colocated `*.test.ts`, `@/`-alias imports, defensive `getStorage()` probing.
- Store the encrypted vault under a new versioned key (e.g. `archer.vault.enc.v1`) and persist the salt + IV + ciphertext together as base64-encoded fields in a JSON envelope, so the shape can evolve.

**Block If:**

- The intent requires replacing the plaintext save-on-generation path in `app/page.tsx` with a passphrase prompt in THIS story. (The passphrase-prompt UI belongs to Story 4.3; wiring it here would fantasize a UI the epic sequences later. If review insists this story must change the page save flow, HALT with blocking condition `passphrase UI scope conflict`.)

**Never:**

- No hand-rolled or custom cryptographic scheme; no third-party crypto library.
- No storing the passphrase, the derived key, or plaintext vault content anywhere at rest.
- No saved-breakdowns UI, unlock modal, restore flow, or passphrase prompt (Story 4.3).
- No server-side storage or network transmission of any kind.
- No hand-rolled binary formats — the persisted envelope is JSON with base64 fields.

## I/O & Edge-Case Matrix

| Scenario                   | Input / State                                          | Expected Output / Behavior                                                                                 | Error Handling                                                                  |
| -------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Derive key                 | passphrase + salt (Uint8Array)                         | AES-GCM `CryptoKey` derived via PBKDF2                                                                     | Rejects only on absent `crypto.subtle` → typed failure                          |
| Encrypt round-trip         | plaintext string + key                                 | `decrypt(encrypt(x)) === x` for arbitrary UTF-8 (incl. emoji, long text)                                   | N/A                                                                             |
| Wrong passphrase           | ciphertext bundle + key from different passphrase      | Typed failure `{ success: false, reason: "decrypt" }`                                                      | AES-GCM auth-tag mismatch caught; no partial/garbage returned                   |
| Tampered ciphertext        | valid key + mutated ciphertext/IV                      | Typed `reason: "decrypt"` failure                                                                          | Caught; never throws across boundary                                            |
| Save encrypted entry       | passphrase + new entry, empty/existing encrypted vault | Entry appended; container re-encrypted with fresh IV; ciphertext written; `{ success: true, data: entry }` | Write quota/unavailable → typed failure, prior ciphertext intact                |
| List encrypted entries     | correct passphrase, populated encrypted vault          | Decrypted `VaultEntry[]` in `{ success: true }`                                                            | Missing/corrupt envelope → treated as empty vault `{ success: true, data: [] }` |
| List with wrong passphrase | wrong passphrase, populated encrypted vault            | `{ success: false, reason: "decrypt" }` — "couldn't unlock"                                                | No entries leaked                                                               |
| Corrupt envelope           | stored value is not valid JSON / wrong shape           | Reads collapse to empty vault; a fresh encrypted save still succeeds                                       | Caught; parse failure isolated                                                  |
| Storage unavailable        | `localStorage` throws / undefined                      | Typed `reason: "unavailable"` on write; empty vault on read                                                | Caught; never throws                                                            |

</intent-contract>

## Code Map

- `archer/lib/vault/crypto.ts` -- NEW. Pure Web Crypto module. `generateSalt()` / `generateIv()` via `crypto.getRandomValues`; `deriveKey(passphrase, salt)` (PBKDF2, SHA-256, high iteration count, `AES-GCM` 256-bit, `deriveKey` usage); `encryptString(plaintext, key, iv)` → ciphertext bytes; `decryptString(ciphertext, key, iv)` → plaintext or typed `decrypt` failure. Base64 helpers for byte↔string. No React, no network.
- `archer/lib/vault/crypto.test.ts` -- NEW. Round-trip property (`decrypt(encrypt(x)) === x`) across varied inputs, wrong-key failure, tampered-ciphertext failure, salt/IV randomness (distinct across calls), no-network assertion.
- `archer/lib/vault/types.ts` -- EDIT. Add `VaultFailureReason` member `"decrypt"` (couldn't unlock). Add an `EncryptedVaultEnvelope` interface (`schemaVersion`, base64 `salt`, base64 `iv`, base64 `ciphertext`). Keep `VaultEntry`/`VaultSchema` unchanged (the plaintext container is what gets encrypted).
- `archer/lib/vault/encrypted-storage.ts` -- NEW. Passphrase-keyed async API mirroring `storage.ts`: `saveEntryEncrypted(passphrase, input)`, `listEntriesEncrypted(passphrase)`, `readEntryEncrypted(passphrase, id)`, `deleteEntryEncrypted(passphrase, id)`, `clearEncryptedVault()`. Reads/writes the JSON envelope under `ENCRYPTED_VAULT_KEY = "archer.vault.enc.v1"`. Reuses `crypto.ts` for derive/encrypt/decrypt and mirrors `storage.ts` defensive `getStorage()` + quota classification. Reuses `generateId`/append semantics equivalent to `storage.ts`.
- `archer/lib/vault/encrypted-storage.test.ts` -- NEW. Full I/O matrix: save→list round-trip, wrong-passphrase list failure, corrupt envelope → empty, storage unavailable/quota, delete/clear, no-network.
- `archer/lib/vault/storage.ts` -- REFERENCE ONLY. Establishes the `getStorage()` probe, `classifyWriteError` quota handling, `generateId` fallback, and typed-result conventions to mirror in `encrypted-storage.ts`. Do not change its plaintext behavior in this story.
- `archer/app/page.tsx` -- REFERENCE ONLY. Current plaintext `saveEntry` wiring stays as-is; the passphrase-prompt UI that would switch it to the encrypted path is Story 4.3. Do not modify here.
- `archer/vitest.config.ts` / `archer/vitest.setup.ts` -- REFERENCE. jsdom environment exposes `crypto.subtle` and `crypto.getRandomValues` (verified), so Web Crypto tests run without extra setup. `@/` alias → project root.

## Tasks & Acceptance

**Execution:**

- [ ] `archer/lib/vault/types.ts` -- Add `"decrypt"` to `VaultFailureReason`; add `EncryptedVaultEnvelope` (schemaVersion + base64 salt/iv/ciphertext) -- gives the encrypted layer typed failures and a stable persisted shape.
- [ ] `archer/lib/vault/crypto.ts` -- Implement `generateSalt`, `generateIv`, `deriveKey` (PBKDF2→AES-GCM), `encryptString`, `decryptString`, and base64 codecs using only Web Crypto; `decryptString` returns a typed `decrypt` failure on auth-tag mismatch rather than throwing -- the standard-primitive encryption core (NFR9).
- [ ] `archer/lib/vault/crypto.test.ts` -- Unit-test the round-trip property, wrong-key failure, tampered-ciphertext failure, salt/IV uniqueness, and no-network -- proves the AC's round-trip + wrong-key coverage.
- [ ] `archer/lib/vault/encrypted-storage.ts` -- Implement passphrase-keyed `saveEntryEncrypted`/`listEntriesEncrypted`/`readEntryEncrypted`/`deleteEntryEncrypted`/`clearEncryptedVault` over the JSON envelope under `archer.vault.enc.v1`, encrypting the serialized `VaultSchema`; tolerate missing/corrupt envelope as empty on read; catch quota/unavailable on write; surface wrong-passphrase as `reason: "decrypt"` -- the encrypted persistence layer 4.3+ read through.
- [ ] `archer/lib/vault/encrypted-storage.test.ts` -- Unit-test every I/O & Edge-Case Matrix row: save→list round-trip, wrong-passphrase, corrupt envelope, unavailable, quota, delete, clear, no-network -- proves graceful failure and that stored bytes are ciphertext, not plaintext.

**Acceptance Criteria:**

- Given an entry is saved through the encrypted storage API, when the stored value under `archer.vault.enc.v1` is inspected, then the goal/project input text and output markdown appear only as ciphertext (base64), not as human-readable plaintext (FR22).
- Given a passphrase and a per-vault random salt, when a key is derived, then it is derived via the Web Crypto API using PBKDF2 and used for AES-GCM, with a fresh random IV per encryption and no custom/hand-rolled scheme (NFR9).
- Given a vault encrypted under one passphrase, when a caller attempts to read it with a different passphrase, then the operation returns a typed `{ success: false, reason: "decrypt" }` "couldn't unlock" result and no partial or garbage entry data is returned.
- Given the `lib/vault/` crypto and encrypted-storage modules, when inspected, then encrypt and decrypt are covered by unit tests including a round-trip property (`decrypt(encrypt(x)) === x`) and a wrong-key failure case, and neither module imports React nor makes a network request.

## Design Notes

Persisted envelope (illustrative, ~8 lines):

```ts
// archer/lib/vault/types.ts
export interface EncryptedVaultEnvelope {
  schemaVersion: 1;
  salt: string; // base64 — per-vault, generated once
  iv: string; // base64 — fresh per write
  ciphertext: string; // base64 — AES-GCM over JSON.stringify(VaultSchema)
}
```

Derivation/encryption (illustrative, ~9 lines):

```ts
// archer/lib/vault/crypto.ts
const keyMaterial = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(passphrase),
  "PBKDF2",
  false,
  ["deriveKey"],
);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: 210_000, hash: "SHA-256" },
  keyMaterial,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt", "decrypt"],
);
// encrypt: crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes)
// decrypt: try { ...decrypt... } catch { return { success:false, reason:"decrypt" } }
```

Rationale: encrypting the whole serialized container (not per-entry) keeps the vault atomic and mirrors 4.1's single-key design, so decrypt-modify-encrypt is the natural read-modify-write. AES-GCM's authentication tag makes a wrong passphrase (or tampered bytes) fail as a caught exception, which maps cleanly to `reason: "decrypt"` — satisfying "no partial/garbage data." The salt is stored in the envelope (it is not secret; its job is to defeat precomputation), while the passphrase and derived key are never persisted. The plaintext `storage.ts` path is intentionally left intact: the epic sequences the passphrase-prompt UI into Story 4.3, so this story ships the encryption layer that 4.3 will wire in, avoiding a half-built UI here.

## Verification

**Commands:**

- `npm test -- --run` (in `archer/`) -- expected: all crypto + encrypted-storage tests pass, including round-trip, wrong-key, tampered, corrupt, unavailable, quota.
- `npx tsc --noEmit` (in `archer/`) -- expected: no type errors.
- `npm run lint` (in `archer/`) -- expected: clean.
- `npm run build` (in `archer/`) -- expected: static export succeeds (confirms no server dependency introduced).

**Manual checks:**

- In a test/dev context, save an entry via the encrypted API, then read `localStorage["archer.vault.enc.v1"]`: the value is a JSON envelope whose `ciphertext` is base64 and contains no readable goal text; decrypting with the correct passphrase restores the entry, and a wrong passphrase yields the "couldn't unlock" result.

## Review Triage Log

### 2026-08-31 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 2, low 0)
- defer: 8: (high 1, medium 4, low 3)
- reject: 3: (high 0, medium 0, low 3)
- addressed_findings:
  - `[medium]` `[patch]` `randomBytes` did not guard `crypto.getRandomValues` absence, so `generateSalt`/`generateIv` could throw and escape `saveEntryEncrypted`/`deleteEntryEncrypted`, violating the never-throw boundary. Fixed by wrapping the salt-fallback + IV generation in `writeVault` in a try/catch returning `reason: "unavailable"`; added a test stubbing `getRandomValues` to throw and asserting `{ success: false, reason: "unavailable" }` with nothing persisted.
  - `[medium]` `[patch]` The "treats malformed base64 fields as empty" test asserted a tautology (`success === true || success === false`), verifying nothing. Replaced with a concrete `expect(listed).toEqual({ success: true, data: [] })`; the assertion holds against the documented contract.

## Auto Run Result

Status: done

### Summary

Delivered vault encryption at rest for Story 4.2 as an isolated, pure `lib/vault/` layer built only on the Web Crypto API. A new crypto core derives an AES-GCM-256 key from a user passphrase via PBKDF2 (SHA-256, 210,000 iterations) with a per-vault random salt and a fresh IV per write, and a passphrase-keyed encrypted storage API serializes the whole `VaultSchema` container, encrypts it, and persists a base64 JSON envelope under `archer.vault.enc.v1`. A wrong passphrase (or tampered ciphertext) fails cleanly with a typed `reason: "decrypt"` ("couldn't unlock") and never returns partial or garbage data. No React, no network, no third-party crypto. The plaintext `storage.ts` path and `app/page.tsx` were intentionally left untouched — the passphrase-prompt/unlock UI belongs to Story 4.3 per the epic sequencing.

### Files Changed

- `archer/lib/vault/types.ts` — added `"decrypt"` to `VaultFailureReason` and the `EncryptedVaultEnvelope` interface (base64 salt/iv/ciphertext + schemaVersion).
- `archer/lib/vault/crypto.ts` — NEW. Pure Web Crypto module: `generateSalt`, `generateIv`, `deriveKey` (PBKDF2→AES-GCM), `encryptString`, `decryptString` (typed `decrypt` failure), base64 codecs.
- `archer/lib/vault/crypto.test.ts` — NEW. Round-trip property, wrong-key, wrong-salt, tampered ciphertext/IV, subtle-absent, salt/IV uniqueness, no-network.
- `archer/lib/vault/encrypted-storage.ts` — NEW. `saveEntryEncrypted`/`listEntriesEncrypted`/`readEntryEncrypted`/`deleteEntryEncrypted`/`clearEncryptedVault` over the encrypted envelope, mirroring `storage.ts` conventions; boundary-safe against missing secure randomness.
- `archer/lib/vault/encrypted-storage.test.ts` — NEW. Full I/O matrix incl. ciphertext-at-rest, wrong-passphrase on every op, corrupt/malformed envelope, unavailable/quota, secure-randomness-unavailable, no-network.

### Review Findings Breakdown

- Patches applied: 2 (both medium) — never-throw boundary guard for missing `getRandomValues`; replaced a tautological test assertion.
- Deferred: 8 (1 high, 4 medium, 3 low) — recorded in frontmatter `deferred`. The high item is wiring the encrypted layer into the app save path + unlock UI (Story 4.3). Others: wrong-pass vs empty-vault UX guard, persist KDF params, schemaVersion gating/migration, KDF-strength regression guard, multi-tab safety, derived-key caching, AAD binding.
- Rejected: 3 (all low, noise) — `generateId` Math.random collision (mirrors accepted 4.1 pattern, already covered), `TextDecoder` fatal option for invalid-UTF-8-after-valid-GCM-tag (cryptographically implausible), `clearEncryptedVault` confirmation semantics (a 4.3 UI concern, module function is correct).

### Follow-up Review

`followup_review_recommended: true`. Patched findings this pass: 0 high, 2 medium, 0 low. Score = 3×2 + 1×0 = 6 ≥ 5 → true.

### Verification Performed

- `npm test -- --run` (archer/) — 274 tests across 20 files pass (was 273 pre-patch; +1 secure-randomness boundary test).
- `npx tsc --noEmit` (archer/) — no type errors.
- `npm run lint` (archer/) — clean.
- `npm run build` (archer/) — static export succeeds; no server dependency introduced.
- Matrix test audit — every I/O & Edge-Case Matrix row is covered by a test that ran and passed.

### Residual Risks

- The encryption layer is not yet exercised by the running app: the generation save path still writes plaintext via `storage.ts`. Under the app-observable reading of AC1/AC3, ciphertext-at-rest and the "couldn't unlock" message are not user-visible until Story 4.3 wires the unlock UI. This is deferred (high) by design of the epic sequencing, not left silently.
- PBKDF2 work factor and KDF params are not persisted per-envelope and not pinned by a regression test — deferred (medium) before crypto parameters change.
