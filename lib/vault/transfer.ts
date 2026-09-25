/**
 * Vault export/import core (Story 4.4) — the pure, React-free transfer layer.
 *
 * The encrypted vault (4.2) and its saved-breakdowns UI (4.3) live only in
 * this browser's localStorage. This module lets a user back up their vault to
 * a single downloadable file and import it back — entirely client-side, with
 * no network request of any kind (NFR8) and no new storage path or schema
 * change (it reuses `encrypted-storage.ts` and `crypto.ts`).
 *
 * Export is safe by construction: the stored value is ALREADY ciphertext, so
 * export reads the raw envelope string and downloads it verbatim (FR22 holds
 * for the exported artifact — plaintext goal content never touches the file).
 *
 * Import validates the file is a well-formed `EncryptedVaultEnvelope` BEFORE
 * touching storage — the invariant that guarantees "no partial import". It
 * then either MERGES (only when an unlocked session's passphrase decrypts BOTH
 * the current and imported envelopes: union entries by id, imported wins on
 * conflict, re-encrypt under the session passphrase) or REPLACES the stored
 * envelope wholesale. Replace is the safe, always-available default.
 *
 * Every function returns a typed `VaultResult`; nothing throws across the
 * module boundary.
 */

import { downloadJson } from "@/lib/utils/download";
import {
    decryptEnvelope,
    encryptVaultToEnvelope,
    isEncryptedVaultEnvelope,
    readRawEnvelopeString,
    readStoredEnvelope,
    writeRawEnvelope,
} from "./encrypted-storage";
import type {
    EncryptedVaultEnvelope,
    VaultEntry,
    VaultResult,
    VaultSchema,
} from "./types";

/** Default filename for an exported vault. */
export const EXPORT_FILENAME = "archer-vault.json";

/** What an import did: merged two vaults or replaced the stored one. */
export type ImportOutcome = "merged" | "replaced";

/** Result payload of a successful import. */
export interface ImportResult {
    outcome: ImportOutcome;
    /** Number of entries in the vault after import (for user messaging). */
    count: number;
}

/**
 * A session seam for merge. The component/hook passes the in-memory passphrase
 * so import can attempt a merge; omit it (or pass null) to force replace.
 */
export interface TransferSession {
    passphrase: string | null;
}

/**
 * Export the encrypted vault as a single downloadable JSON file.
 *
 * Reads the raw envelope string from storage and downloads it verbatim (it is
 * already ciphertext). Refuses to export when no vault exists. Returns a typed
 * result — never throws, never makes a network request.
 */
export function exportVault(): VaultResult<{ filename: string }> {
    const raw = readRawEnvelopeString();
    if (raw === null) {
        // Nothing to export: either no vault has been saved yet or storage is
        // unavailable. Both are surfaced as `unavailable` here; the caller's
        // message covers the common "save a breakdown first" case.
        return { success: false, reason: "unavailable" };
    }

    // Guard: only export a well-formed envelope (never a corrupt blob).
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { success: false, reason: "unknown" };
    }
    if (!isEncryptedVaultEnvelope(parsed)) {
        return { success: false, reason: "unknown" };
    }

    const downloaded = downloadJson(raw, EXPORT_FILENAME);
    if (!downloaded.success) {
        return { success: false, reason: "unavailable" };
    }
    return { success: true, data: { filename: EXPORT_FILENAME } };
}

/** Union two entry lists by id; entries from `incoming` win on conflict. */
function mergeEntries(
    current: VaultEntry[],
    incoming: VaultEntry[],
): VaultEntry[] {
    const byId = new Map<string, VaultEntry>();
    for (const entry of current) {
        byId.set(entry.id, entry);
    }
    // Imported copy wins on conflicting id.
    for (const entry of incoming) {
        byId.set(entry.id, entry);
    }
    return Array.from(byId.values());
}

/**
 * Import a previously exported vault file.
 *
 * 1. Parse + validate the envelope shape → reject (no write) if malformed.
 * 2. If a session passphrase decrypts BOTH the current and imported envelopes,
 *    union their entries (dedupe by id, imported wins), re-encrypt under the
 *    session passphrase, and write → "merged".
 * 3. Otherwise write the imported envelope verbatim → "replaced".
 *
 * On any invalid input the stored vault is left byte-for-byte untouched.
 */
export async function importVault(
    fileText: string,
    session?: TransferSession | null,
): Promise<VaultResult<ImportResult>> {
    // --- Validate BEFORE any write (no partial import) ---
    if (typeof fileText !== "string" || fileText.trim() === "") {
        return { success: false, reason: "unknown" };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(fileText);
    } catch {
        return { success: false, reason: "unknown" };
    }

    if (!isEncryptedVaultEnvelope(parsed)) {
        return { success: false, reason: "unknown" };
    }
    const imported: EncryptedVaultEnvelope = parsed;

    const passphrase = session?.passphrase ?? null;
    const current = readStoredEnvelope();

    // --- Try merge only with an in-memory passphrase and an existing vault ---
    if (passphrase !== null && current !== null) {
        const currentVault = await decryptEnvelope(passphrase, current);
        const importedVault = await decryptEnvelope(passphrase, imported);

        if (currentVault.success && importedVault.success) {
            const unioned: VaultSchema = {
                schemaVersion: currentVault.data.schemaVersion,
                entries: mergeEntries(
                    currentVault.data.entries,
                    importedVault.data.entries,
                ),
            };

            const reEncrypted = await encryptVaultToEnvelope(
                passphrase,
                unioned,
            );
            if (!reEncrypted.success) {
                return reEncrypted;
            }

            const written = writeRawEnvelope(reEncrypted.data);
            if (!written.success) {
                return written;
            }
            return {
                success: true,
                data: { outcome: "merged", count: unioned.entries.length },
            };
        }
        // Passphrase didn't open both → fall through to replace.
    }

    // --- Replace: write the imported envelope verbatim ---
    const written = writeRawEnvelope(imported);
    if (!written.success) {
        return written;
    }

    // Report the entry count when we can decrypt the imported vault; otherwise
    // 0 (we can't read ciphertext without the passphrase, which is fine).
    let count = 0;
    if (passphrase !== null) {
        const importedVault = await decryptEnvelope(passphrase, imported);
        if (importedVault.success) {
            count = importedVault.data.entries.length;
        }
    }

    return { success: true, data: { outcome: "replaced", count } };
}
