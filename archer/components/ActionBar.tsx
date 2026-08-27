"use client";

import { copyToClipboard } from "@/lib/utils/clipboard";
import { useCallback, useEffect, useRef, useState } from "react";

interface ActionBarProps {
    markdown: string;
}

export default function ActionBar({ markdown }: ActionBarProps) {
    const [copied, setCopied] = useState(false);
    const [showFallback, setShowFallback] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Cleanup timeout on unmount (handles output cleared / mode switch)
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Auto-select textarea content when fallback modal opens
    useEffect(() => {
        if (showFallback && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [showFallback]);

    const handleCopy = useCallback(async () => {
        // Cancel any existing timer (rapid re-click scenario)
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        const result = await copyToClipboard(markdown);

        if (result.success) {
            setCopied(true);
            timeoutRef.current = setTimeout(() => {
                setCopied(false);
                timeoutRef.current = null;
            }, 2000);
        } else {
            // Permission denied or other error — show fallback modal
            setShowFallback(true);
        }
    }, [markdown]);

    const closeFallback = useCallback(() => {
        setShowFallback(false);
    }, []);

    return (
        <>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleCopy}
                    className="min-h-[44px] min-w-[44px] rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                >
                    <span
                        className={
                            copied ? "text-[var(--color-success)]" : undefined
                        }
                    >
                        {copied ? "Copied ✓" : "Copy Markdown"}
                    </span>
                </button>

                {/* Screen reader announcement */}
                <span aria-live="polite" className="sr-only">
                    {copied ? "Markdown copied to clipboard" : ""}
                </span>
            </div>

            {/* Fallback modal */}
            {showFallback && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Copy markdown manually"
                    onKeyDown={(e) => {
                        if (e.key === "Escape") closeFallback();
                    }}
                >
                    <div className="mx-4 w-full max-w-lg rounded-[var(--radius-lg)] bg-[var(--color-background)] p-6 shadow-xl">
                        <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">
                            Copy Markdown
                        </h2>
                        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                            Clipboard access was denied. Select all text below and copy
                            manually (Ctrl+C / Cmd+C).
                        </p>
                        <textarea
                            ref={textareaRef}
                            readOnly
                            value={markdown}
                            className="h-64 w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                        />
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={closeFallback}
                                className="min-h-[44px] min-w-[44px] rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
