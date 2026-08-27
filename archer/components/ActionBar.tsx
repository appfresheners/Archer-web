"use client";

import { copyToClipboard } from "@/lib/utils/clipboard";
import { downloadMarkdown } from "@/lib/utils/download";
import { slugify } from "@/lib/utils/slugify";
import { useCallback, useEffect, useRef, useState } from "react";

interface ActionBarProps {
    markdown: string;
    mode: "goal" | "project";
    inputText: string;
}

export default function ActionBar({ markdown, mode, inputText }: ActionBarProps) {
    const [copied, setCopied] = useState(false);
    const [downloaded, setDownloaded] = useState(false);
    const [showFallback, setShowFallback] = useState(false);
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const downloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Cleanup timeouts on unmount (handles output cleared / mode switch)
    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }
            if (downloadTimeoutRef.current) {
                clearTimeout(downloadTimeoutRef.current);
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
        if (copyTimeoutRef.current) {
            clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = null;
        }

        const result = await copyToClipboard(markdown);

        if (result.success) {
            setCopied(true);
            copyTimeoutRef.current = setTimeout(() => {
                setCopied(false);
                copyTimeoutRef.current = null;
            }, 2000);
        } else {
            // Permission denied or other error — show fallback modal
            setShowFallback(true);
        }
    }, [markdown]);

    const handleDownload = useCallback(() => {
        // Guard against duplicate downloads during confirmation state
        if (downloadTimeoutRef.current) return;

        const slug = slugify(inputText);
        const filename = `archer-${mode}-${slug}.md`;
        const result = downloadMarkdown(markdown, filename);

        if (result.success) {
            setDownloaded(true);
            downloadTimeoutRef.current = setTimeout(() => {
                setDownloaded(false);
                downloadTimeoutRef.current = null;
            }, 2000);
        }
    }, [markdown, mode, inputText]);

    const closeFallback = useCallback(() => {
        setShowFallback(false);
    }, []);

    return (
        <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

                <button
                    type="button"
                    onClick={handleDownload}
                    className="min-h-[44px] min-w-[44px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-4 py-2 font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                >
                    <span
                        className={
                            downloaded ? "text-[var(--color-success)]" : undefined
                        }
                    >
                        {downloaded ? "Downloaded ✓" : "Download .md"}
                    </span>
                </button>

                {/* Screen reader announcements */}
                <span aria-live="polite" className="sr-only">
                    {copied ? "Markdown copied to clipboard" : ""}
                    {downloaded ? "Markdown file downloaded" : ""}
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
