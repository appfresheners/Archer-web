"use client";

import type { VaultEntry } from "@/lib/vault/types";
import { useCallback, useEffect, useRef, useState } from "react";

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
    onClose,
}: SavedBreakdownsProps) {
    const [passphrase, setPassphrase] = useState("");
    const [unlockError, setUnlockError] = useState("");
    const [actionError, setActionError] = useState("");
    const [busy, setBusy] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const clearConfirmRef = useRef<HTMLButtonElement>(null);

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
