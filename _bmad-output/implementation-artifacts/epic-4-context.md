# Epic 4 Context: Local-First Goal Persistence & Portability

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give Archer a memory it has never had. Today the app holds no state between sessions — a refresh loses everything — so this epic introduces the first persistence layer: an in-browser vault that saves every generated breakdown, encrypts it at rest, lets users revisit and manage past goals, and carries the whole vault to another device. All of this stays local-first and passwordless-portable, preserving Archer's no-account, no-server, no-tracking commitment. Note: the base planning artifacts (PRD, architecture spine, UX design) are all scoped to MVP1 and explicitly exclude persistence, encryption, and portability; the authoritative detail for this epic lives in the epics document and the post-MVP requirements, so treat those as the source of truth where the older docs are silent.

## Stories

- Story 4.1: Local Vault Storage Layer
- Story 4.2: Vault Encryption at Rest
- Story 4.3: Saved Breakdowns List & Restore
- Story 4.4: Vault Export & Import
- Story 4.5: Portable Passwordless Identity (Link + QR)

## Requirements & Constraints

Every generated breakdown should be persisted with its full context — the input text, mode, generation options, output markdown, and a creation timestamp — so a user can close the tab and come back to their work later. Persistence must never undermine the on-screen result: a storage failure (unavailable or full) surfaces a clear message and leaves the current output usable.

The vault must be encrypted at rest so raw goal content is never readable in plaintext from browser storage. Encryption must use a standard, well-reviewed browser primitive rather than any custom scheme, with the key derived from a user passphrase and a per-vault random salt. A wrong passphrase must fail cleanly with a plain "couldn't unlock" outcome and never surface partial or garbage data.

Users need full ownership and control of their history: view saved breakdowns newest-first, re-open any entry to fully restore its output and the options that produced it, delete individual entries, and clear the entire vault behind an explicit, clearly-worded confirmation. They can also export the whole vault as a single file they own and import a previously exported file, being told whether entries were merged or replaced; corrupt or invalid files are rejected without partial import.

Portability is passwordless: the app can produce a saveable link and a QR code encoding the key material needed to unlock the vault, so a second device can open it without an account or passphrase prompt. Because that link/QR grants full access, the UI must warn clearly that it should be stored securely.

Overarching constraints: all persistence, encryption, export/import, and portability run entirely client-side with no new server-side storage of any kind, and all new UI meets the same WCAG 2.1 AA bar as existing controls (keyboard nav, ARIA, 44×44px targets, contrast, reduced-motion).

## Technical Decisions

Archer is a static, client-side-only app (Next.js App Router with static export, no server runtime, no API layer for storage, no database), so the vault must live and operate purely in the browser — no data leaves the device. This is the hard boundary the whole epic is built around.

Storage is a dedicated, isolated module (conceptually `lib/vault/`) that exposes pure, testable create / read / list / delete functions and is kept out of the React components, consistent with the project's layering rule that browser APIs and non-UI logic live in `lib/` while components only orchestrate. Persistence uses browser storage (localStorage or IndexedDB) behind a versioned schema so the stored shape can evolve safely.

Encryption uses the browser-native Web Crypto API (e.g., PBKDF2 for key derivation, AES-GCM for encryption) with a per-vault random salt — no third-party crypto libraries and no hand-rolled cryptography. Encrypt/decrypt should be unit-tested including a round-trip property (decrypt(encrypt(x)) === x) and a wrong-key failure case.

Export/import should reuse the existing client-side download pattern (Blob → object URL → anchor click → revoke, no server round-trip) and be covered by an export→import round-trip test that preserves all entries. Portable-identity key material must be carried in a way that never reaches an Archer-owned server — for example a URL fragment or a locally rendered QR — with that property verified by test or captured as a documented threat note.

The generation-options field stored per entry is a shared data shape also owned by Epic 5; the vault entry and the generation request must use the same TypeScript type so saved options round-trip faithfully.

## Cross-Story Dependencies

Story 4.1 (storage layer) is the foundation for 4.2–4.5; the encryption in 4.2 wraps whatever 4.1 persists. List/restore (4.3), export/import (4.4), and portable identity (4.5) all read through the encrypted vault, so their behavior depends on the 4.1/4.2 schema and key handling being settled first. Export/import (4.4) reuses the existing client-side download utility established in the export/actions work of an earlier epic. There is a shared contract with Epic 5: the generation-options object persisted with each entry (FR37) is defined by Epic 5's data-contract work, so the vault entry shape and Epic 5's options type must stay aligned.
