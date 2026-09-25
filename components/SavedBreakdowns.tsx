"use client";

import { copyToClipboard } from "@/lib/utils/clipboard";
import type { VaultEntry } from "@/lib/vault/types";
import * as QRCodeNS from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

// Access the pure `toString` renderer defensively across CJS/ESM interop:
// the `qrcode` package is CommonJS and may surface its named exports under a
// `default` wrapper depending on the bundler. This never touches the network
// or crypto — it only draws the link string into an SVG.
const renderQrSvg: (
    text: string,
    options: { type: "svg"; errorCorrectionLevel: "M"; margin: number },
) => Promise<string> =
    (QRCodeNS as { toString?: unknown }).toString !== undefined
        ? ((QRCodeNS as unknown as { toString: typeof renderQrSvg }).toString)
        : (
            (QRCodeNS as { default?: { toString: typeof renderQrSvg } })
                .default as { toString: typeof renderQrSvg }
        ).toString;

interface SavedBreakdownsProps {
    /** True once the session passphrase has been accepted. */
    unlocked: boolean;
    /** Entries to render, expected most-recent-first. */
    entries: VaultEntry[];
    /**
     * Attempt to unlock with the typed passphrase. Returns a plain error
     * message to display, or null on success. The parent owns the storage
     * call; this component only renders the outcome.
     */
    onUnlock: (passphrase: string) => Promise<string | null>;
    /** Restore an entry into the main output panel. */
    onRestore: (entry: VaultEntry) => void;
    /**
     * Delete a single entry. Returns a plain error message on failure, or null
     * on success (the list updates in place via the `entries` prop).
     */
    onDelete: (id: string) => Promise<string | null>;
    /** Clear the whole vault. Returns a plain error message or null. */
    onClear: () => Promise<string | null>;
    /**
     * Export the vault to a downloadable file. Returns a plain success message
     * on success, or an error message string prefixed so the caller can tell
     * them apart. Convention: returns `{ ok: true, message }` on success and
     * `{ ok: false, message }` on failure.
     */
    onExport: () => { ok: boolean; message: string };
    /**
     * Import a vault file's text. Returns a plain outcome message on success
     * (merged/replaced) or an error message on failure.
     */
    onImport: (fileText: string) => Promise<{ ok: boolean; message: string }>;
    /**
     * Build the portable-identity link that carries the vault unlock key in
     * its URL fragment. Returns the link only when the session is unlocked, or
     * `null` while locked. All key logic lives in the parent/session; this
     * component only receives and displays the produced string (Story 4.5).
     */
    identityLink: () => string | null;
    /** Close the saved-breakdowns view. */
    onClose: () => void;
}

/** Format a createdAt timestamp into a human-readable local string. */
function formatTimestamp(createdAt: number): string {
    try {
        return new Date(createdAt).toLocaleString();
    } catch {
        return "";
    }
}

/** Shared button classes mirroring ActionBar's token/target conventions. */
const primaryButton =
    "min-h-[44px] min-w-[44px] rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";
const secondaryButton =
    "min-h-[44px] min-w-[44px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-4 py-2 font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export default function SavedBreakdowns({
    unlocked,
    entries,
    onUnlock,
    onRestore,
    onDelete,
    onClear,
    onExport,
    onImport,
    identityLink,
    onClose,
}: SavedBreakdownsProps) {
    const [passphrase, setPassphrase] = useState("");
    const [unlockError, setUnlockError] = useState("");
    const [actionError, setActionError] = useState("");
    const [transferNotice, setTransferNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const clearConfirmRef = useRef<HTMLButtonElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    // Portable identity (Story 4.5). The link and QR are only produced when
    // the user explicitly reveals them, behind the security warning. The link
    // (and thus the key material) lives only in component state transiently —
    // never persisted.
    const [identityRevealed, setIdentityRevealed] = useState(false);
    const [identityLinkValue, setIdentityLinkValue] = useState("");
    const [qrSvg, setQrSvg] = useState("");
    const [qrError, setQrError] = useState("");
    const [identityCopyNotice, setIdentityCopyNotice] = useState("");

    // Move focus into the confirm dialog when it opens (a11y).
    useEffect(() => {
        if (showClearConfirm && clearConfirmRef.current) {
            clearConfirmRef.current.focus();
        }
    }, [showClearConfirm]);

    const handleUnlock = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();
            setUnlockError("");
            setBusy(true);
            const message = await onUnlock(passphrase);
            setBusy(false);
            if (message) {
                setUnlockError(message);
            }
        },
        [onUnlock, passphrase],
    );

    const handleDelete = useCallback(
        async (id: string) => {
            setActionError("");
            const message = await onDelete(id);
            if (message) {
                setActionError(message);
            }
        },
        [onDelete],
    );

    const handleConfirmClear = useCallback(async () => {
        setActionError("");
        const message = await onClear();
        setShowClearConfirm(false);
        if (message) {
            setActionError(message);
        }
    }, [onClear]);

    const handleExport = useCallback(() => {
        setActionError("");
        setTransferNotice("");
        const result = onExport();
        if (result.ok) {
            setTransferNotice(result.message);
        } else {
            setActionError(result.message);
        }
    }, [onExport]);

    // Reveal the portable-identity link (and trigger local QR rendering).
    const handleRevealIdentity = useCallback(() => {
        setIdentityCopyNotice("");
        setQrError("");
        const link = identityLink();
        if (!link) {
            // Only offered while unlocked; defensively no-op if locked.
            return;
        }
        setIdentityLinkValue(link);
        setIdentityRevealed(true);
    }, [identityLink]);

    const handleCopyIdentity = useCallback(async () => {
        setIdentityCopyNotice("");
        if (!identityLinkValue) {
            return;
        }
        const result = await copyToClipboard(identityLinkValue);
        setIdentityCopyNotice(
            result.success
                ? "Link copied. Store it somewhere only you can reach."
                : "Couldn't copy the link — select and copy it manually.",
        );
    }, [identityLinkValue]);

    // Render the QR locally (offline, no network) whenever the link changes.
    // Produces an SVG string; a render failure leaves the link usable and
    // surfaces a message instead of crashing.
    useEffect(() => {
        if (!identityRevealed || !identityLinkValue) {
            return;
        }
        let cancelled = false;
        renderQrSvg(identityLinkValue, {
            type: "svg",
            errorCorrectionLevel: "M",
            margin: 1,
        })
            .then((svg) => {
                if (!cancelled) {
                    setQrSvg(svg);
                    setQrError("");
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setQrSvg("");
                    setQrError(
                        "Couldn't render the QR code. Use the link above instead.",
                    );
                }
            });
        return () => {
            cancelled = true;
        };
    }, [identityRevealed, identityLinkValue]);

    const handleImportFile = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            setActionError("");
            setTransferNotice("");
            const file = event.target.files?.[0];
            // Reset the input so selecting the same file again re-triggers.
            event.target.value = "";
            if (!file) {
                return;
            }

            let text: string;
            try {
                text = await file.text();
            } catch {
                setActionError(
                    "Couldn't read that file. Please choose a valid vault export.",
                );
                return;
            }

            const result = await onImport(text);
            if (result.ok) {
                setTransferNotice(result.message);
            } else {
                setActionError(result.message);
            }
        },
        [onImport],
    );

    return (
        <section
            aria-label="Saved breakdowns"
            className="mx-auto max-w-[640px] px-[var(--spacing-page-x)] lg:px-[var(--spacing-page-x-lg)] py-[var(--spacing-section-y)]"
        >
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                    Saved breakdowns
                </h2>
                <button type="button" onClick={onClose} className={secondaryButton}>
                    Close
                </button>
            </div>

            {!unlocked ? (
                <form onSubmit={handleUnlock} className="mt-[var(--spacing-section-y)]">
                    <label
                        htmlFor="vault-passphrase"
                        className="block text-sm font-medium text-[var(--color-text-primary)]"
                    >
                        Passphrase
                    </label>
                    <p
                        id="vault-passphrase-help"
                        className="mt-1 text-sm text-[var(--color-text-secondary)]"
                    >
                        Enter the passphrase for your local vault to view saved
                        breakdowns.
                    </p>
                    <input
                        id="vault-passphrase"
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        aria-describedby="vault-passphrase-help"
                        aria-invalid={unlockError ? true : undefined}
                        autoComplete="off"
                        className="mt-2 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                    />
                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={busy}
                            className={`${primaryButton} disabled:opacity-60`}
                        >
                            {busy ? "Unlocking…" : "Unlock"}
                        </button>
                    </div>
                    {unlockError && (
                        <p
                            role="alert"
                            className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-red-50 p-4 text-sm text-[var(--color-error)]"
                        >
                            {unlockError}
                        </p>
                    )}
                </form>
            ) : (
                <div className="mt-[var(--spacing-section-y)]">
                    {actionError && (
                        <p
                            role="alert"
                            className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-red-50 p-4 text-sm text-[var(--color-error)]"
                        >
                            {actionError}
                        </p>
                    )}

                    {transferNotice && (
                        <p
                            role="status"
                            className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-primary)]"
                        >
                            {transferNotice}
                        </p>
                    )}

                    {entries.length === 0 ? (
                        <p role="status" className="text-sm text-[var(--color-text-secondary)]">
                            No saved breakdowns yet. Generate one and it will appear
                            here.
                        </p>
                    ) : (
                        <>
                            <ul aria-label="Saved breakdowns list" className="flex flex-col gap-3">
                                {entries.map((entry) => (
                                    <li
                                        key={entry.id}
                                        className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-[var(--color-text-primary)]">
                                                {entry.inputText || "(no input)"}
                                            </p>
                                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                                <span className="capitalize">{entry.mode}</span>
                                                {" · "}
                                                <time dateTime={new Date(entry.createdAt).toISOString()}>
                                                    {formatTimestamp(entry.createdAt)}
                                                </time>
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onRestore(entry)}
                                                className={primaryButton}
                                            >
                                                Restore
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(entry.id)}
                                                aria-label={`Delete breakdown: ${entry.inputText || "untitled"}`}
                                                className={secondaryButton}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-[var(--spacing-section-y)]">
                                <button
                                    type="button"
                                    onClick={() => setShowClearConfirm(true)}
                                    className={secondaryButton}
                                >
                                    Clear vault
                                </button>
                            </div>
                        </>
                    )}

                    <div className="mt-[var(--spacing-section-y)] border-t border-[var(--color-border)] pt-[var(--spacing-section-y)]">
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                            Back up &amp; transfer
                        </h3>
                        <p
                            id="vault-transfer-help"
                            className="mt-1 text-sm text-[var(--color-text-secondary)]"
                        >
                            Export your encrypted vault to a file, or import a
                            previously exported file. Nothing leaves this device.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handleExport}
                                aria-describedby="vault-transfer-help"
                                className={secondaryButton}
                            >
                                Export vault
                            </button>
                            <button
                                type="button"
                                onClick={() => importInputRef.current?.click()}
                                aria-describedby="vault-transfer-help"
                                className={secondaryButton}
                            >
                                Import vault
                            </button>
                            <input
                                ref={importInputRef}
                                id="vault-import-file"
                                type="file"
                                accept="application/json,.json"
                                onChange={handleImportFile}
                                aria-label="Import vault file"
                                className="sr-only"
                            />
                        </div>
                    </div>

                    <div className="mt-[var(--spacing-section-y)] border-t border-[var(--color-border)] pt-[var(--spacing-section-y)]">
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                            Portable identity
                        </h3>
                        <p
                            id="portable-identity-help"
                            className="mt-1 text-sm text-[var(--color-text-secondary)]"
                        >
                            Open your vault on another device without retyping your
                            passphrase. Reveal a one-tap link and QR code that carry
                            your unlock key. Everything is generated on this device —
                            nothing is sent to any server.
                        </p>

                        {/* Security warning — shown before the link/QR (FR29). */}
                        <p
                            role="note"
                            className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-red-50 p-4 text-sm text-[var(--color-error)]"
                        >
                            <strong>Security warning:</strong> anyone who has this
                            link or QR code can unlock your vault. Treat it like your
                            passphrase — store it somewhere secure and never share it.
                        </p>

                        {!identityRevealed ? (
                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={handleRevealIdentity}
                                    aria-describedby="portable-identity-help"
                                    className={secondaryButton}
                                >
                                    Reveal portable identity
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 flex flex-col gap-4">
                                <div>
                                    <label
                                        htmlFor="portable-identity-link"
                                        className="block text-sm font-medium text-[var(--color-text-primary)]"
                                    >
                                        Portable identity link
                                    </label>
                                    <input
                                        id="portable-identity-link"
                                        type="text"
                                        readOnly
                                        value={identityLinkValue}
                                        onFocus={(e) => e.currentTarget.select()}
                                        className="mt-2 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                                    />
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={handleCopyIdentity}
                                            className={primaryButton}
                                        >
                                            Copy link
                                        </button>
                                    </div>
                                    {identityCopyNotice && (
                                        <p
                                            role="status"
                                            className="mt-2 text-sm text-[var(--color-text-secondary)]"
                                        >
                                            {identityCopyNotice}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                        Scan to unlock on another device
                                    </p>
                                    {qrError ? (
                                        <p
                                            role="alert"
                                            className="mt-2 text-sm text-[var(--color-error)]"
                                        >
                                            {qrError}
                                        </p>
                                    ) : qrSvg ? (
                                        <div
                                            role="img"
                                            aria-label="QR code containing your vault unlock link. Scanning it opens Archer and unlocks your vault."
                                            className="mt-2 inline-block h-48 w-48 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
                                            // The SVG is produced locally by the QR
                                            // library from the link string; it is
                                            // not user-supplied HTML.
                                            dangerouslySetInnerHTML={{ __html: qrSvg }}
                                        />
                                    ) : (
                                        <p
                                            role="status"
                                            className="mt-2 text-sm text-[var(--color-text-secondary)]"
                                        >
                                            Rendering QR code…
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showClearConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="clear-vault-title"
                    aria-describedby="clear-vault-description"
                    onKeyDown={(e) => {
                        if (e.key === "Escape") setShowClearConfirm(false);
                    }}
                >
                    <div className="mx-4 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-background)] p-6 shadow-xl">
                        <h3
                            id="clear-vault-title"
                            className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]"
                        >
                            Clear all saved breakdowns?
                        </h3>
                        <p
                            id="clear-vault-description"
                            className="mb-4 text-sm text-[var(--color-text-secondary)]"
                        >
                            This permanently deletes every saved breakdown from this
                            device. This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowClearConfirm(false)}
                                className={secondaryButton}
                            >
                                Cancel
                            </button>
                            <button
                                ref={clearConfirmRef}
                                type="button"
                                onClick={handleConfirmClear}
                                className="min-h-[44px] min-w-[44px] rounded-[var(--radius-md)] bg-[var(--color-error)] px-4 py-2 font-medium text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                            >
                                Delete everything
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
