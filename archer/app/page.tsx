"use client";

import ActionBar from "@/components/ActionBar";
import InputSection from "@/components/InputSection";
import ModeToggle from "@/components/ModeToggle";
import OutputPanel from "@/components/OutputPanel";
import SavedBreakdowns from "@/components/SavedBreakdowns";
import { parseIdentityFromHash } from "@/lib/vault/portable-identity";
import type { VaultEntry, VaultFailureReason } from "@/lib/vault/types";
import { useVaultSession } from "@/lib/vault/useVaultSession";
import { useEffect, useRef, useState } from "react";

/** Map a typed vault failure to a plain user-facing message. */
function unlockMessage(reason: VaultFailureReason): string {
  switch (reason) {
    case "decrypt":
      return "Couldn't unlock — check your passphrase and try again.";
    case "unavailable":
      return "Your browser doesn't support local storage or encryption, so saved breakdowns aren't available here.";
    default:
      return "Something went wrong opening your vault. Please try again.";
  }
}

export default function Home() {
  const [mode, setMode] = useState<"goal" | "project">("goal");
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState("");
  const [generationOptions, setGenerationOptions] = useState<
    Record<string, unknown> | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  // Ensures the load-time portable-identity auto-unlock runs at most once.
  const autoUnlockAttempted = useRef(false);

  const session = useVaultSession();

  const handleModeChange = (newMode: "goal" | "project") => {
    setMode(newMode);
    setInputText("");
    setOutput("");
    setGenerationOptions(null);
    setError("");
    setSaveNotice("");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setSaveNotice("");
    setOutput("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputText, mode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setOutput(data.markdown);
      // Epic 5 owns concrete generation options; today a fresh generation has
      // none, so reset to null. Restore rehydrates any saved options directly.
      setGenerationOptions(null);

      // Persist the breakdown to the encrypted local vault, gated on an
      // unlocked passphrase session. A save failure — including there being no
      // unlocked session — must never clear the visible output; it only raises
      // a dismissible notice.
      if (!session.unlocked) {
        setSaveNotice(
          "Unlock your vault from “Saved breakdowns” to save this. Your breakdown is still shown above."
        );
        return;
      }

      const saved = await session.save({
        inputText,
        mode,
        // Fresh generation carries no options yet (Epic 5); persist null so the
        // round-trip field is present without inventing a shape.
        generationOptions: null,
        outputMarkdown: data.markdown,
      });

      if (!saved.success) {
        setSaveNotice(
          saved.reason === "quota"
            ? "Couldn't save to your local vault — storage is full. Your breakdown is still shown above."
            : "Couldn't save to your local vault. Your breakdown is still shown above."
        );
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Restore rehydrates output/mode/input/options directly — deliberately NOT
  // through handleModeChange, which clears input/output.
  const handleRestore = (entry: VaultEntry) => {
    setMode(entry.mode);
    setInputText(entry.inputText);
    setGenerationOptions(entry.generationOptions);
    setError("");
    setSaveNotice("");
    setOutput(entry.outputMarkdown); // triggers the focus/scroll effect
    setShowSaved(false);
  };

  const handleUnlock = async (passphrase: string): Promise<string | null> => {
    const result = await session.unlock(passphrase);
    return result.success ? null : unlockMessage(result.reason);
  };

  const handleDelete = async (id: string): Promise<string | null> => {
    const result = await session.remove(id);
    return result.success ? null : unlockMessage(result.reason);
  };

  const handleClear = async (): Promise<string | null> => {
    const result = await session.clear();
    return result.success ? null : unlockMessage(result.reason);
  };

  const handleExport = (): { ok: boolean; message: string } => {
    const result = session.exportVault();
    if (result.success) {
      return {
        ok: true,
        message: `Vault exported to ${result.data.filename}.`,
      };
    }
    if (result.reason === "unavailable") {
      return {
        ok: false,
        message:
          "Nothing to export yet — save a breakdown first, or your browser blocked the download.",
      };
    }
    return {
      ok: false,
      message: "Couldn't export your vault. Please try again.",
    };
  };

  const handleImport = async (
    fileText: string
  ): Promise<{ ok: boolean; message: string }> => {
    const result = await session.importVault(fileText);
    if (result.success) {
      const { outcome, count } = result.data;
      return {
        ok: true,
        message:
          outcome === "merged"
            ? `Import complete — merged into your vault (${count} saved breakdown${count === 1 ? "" : "s"} total).`
            : `Import complete — replaced your vault with the imported file.`,
      };
    }
    // Distinguish storage-layer failures from an invalid file so the user
    // isn't told a valid backup is corrupt when the real cause is a full or
    // unavailable store. In all cases the existing vault is left unchanged.
    if (result.reason === "quota") {
      return {
        ok: false,
        message:
          "Couldn't import — local storage is full. Your existing vault is unchanged.",
      };
    }
    if (result.reason === "unavailable") {
      return {
        ok: false,
        message:
          "Couldn't import — this browser doesn't support local storage or encryption. Your existing vault is unchanged.",
      };
    }
    return {
      ok: false,
      message:
        "Couldn't import that file — it isn't a valid vault export. Your existing vault is unchanged.",
    };
  };

  // Portable-identity auto-unlock (Story 4.5, FR28). On load, if the URL
  // fragment carries a `#key=…` identity, feed the decoded passphrase into the
  // existing session.unlock (the passphrase IS the key material — no schema or
  // crypto change), open the saved view, and immediately scrub the fragment
  // from the address bar/history so the key doesn't linger. Guarded for
  // SSR/prerender (static export) via typeof-window checks. A wrong key
  // decrypts nothing and simply falls back to the manual unlock form.
  useEffect(() => {
    if (autoUnlockAttempted.current) {
      return;
    }
    autoUnlockAttempted.current = true;

    if (typeof window === "undefined" || typeof window.location === "undefined") {
      return;
    }

    const parsed = parseIdentityFromHash(window.location.hash);
    if (!parsed.success) {
      // No/invalid identity fragment — behave exactly as a normal load.
      return;
    }

    // Scrub the key from the visible URL and history immediately, regardless
    // of whether the subsequent unlock succeeds, so it never lingers.
    const scrubHash = () => {
      try {
        if (
          typeof window !== "undefined" &&
          typeof window.history !== "undefined" &&
          typeof window.history.replaceState === "function"
        ) {
          const { pathname, search } = window.location;
          window.history.replaceState(null, "", `${pathname}${search}`);
        }
      } catch {
        // Non-fatal: the auto-unlock still proceeds even if scrubbing fails.
      }
    };

    // Scrub the key from the address bar / history BEFORE the (deliberately
    // slow, PBKDF2-backed) unlock runs, so the plaintext key does not sit in
    // the visible URL for the duration of the async derivation. The decoded
    // passphrase is already captured in `parsed`. Wrap the unlock so an
    // unexpected throw can never leave the fragment unscrubbed or surface as
    // an unhandled rejection — a wrong key returns a typed failure and simply
    // shows the manual unlock form.
    scrubHash();
    void (async () => {
      try {
        await session.unlock(parsed.data.passphrase);
      } catch {
        // Non-fatal: session stays locked; the manual unlock form is shown.
      } finally {
        // Open the saved view so the arriving user lands on their vault (on a
        // wrong key this shows the manual unlock form). Set inside the async
        // callback so the effect body performs no synchronous state update.
        setShowSaved(true);
      }
    })();
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.focus();

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      outputRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  }, [output]);

  if (showSaved) {
    return (
      <main className="min-h-screen">
        <SavedBreakdowns
          unlocked={session.unlocked}
          entries={session.entries}
          onUnlock={handleUnlock}
          onRestore={handleRestore}
          onDelete={handleDelete}
          onClear={handleClear}
          onExport={handleExport}
          onImport={handleImport}
          identityLink={session.identityLink}
          onClose={() => setShowSaved(false)}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Input section — centered and narrow */}
      <header className="mx-auto max-w-[640px] px-[var(--spacing-page-x)] lg:px-[var(--spacing-page-x-lg)] py-[var(--spacing-section-y)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[length:var(--font-size-hero)] font-bold text-text-primary">
              Archer
            </h1>
            <p className="mt-2 text-text-secondary">
              Type a goal. Get the next actions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSaved(true)}
            className="min-h-[44px] min-w-[44px] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-4 py-2 font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          >
            Saved breakdowns
          </button>
        </div>

        <div className="mt-[var(--spacing-section-y)] flex justify-center">
          <ModeToggle mode={mode} onModeChange={handleModeChange} />
        </div>

        <div className="mt-[var(--spacing-section-y)]">
          <InputSection
            key={mode}
            mode={mode}
            inputText={inputText}
            onInputChange={setInputText}
            onSubmit={handleSubmit}
            disabled={loading}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-red-50 p-4 text-sm text-[var(--color-error)]"
          >
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-[var(--spacing-section-y)] flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]" />
            <p className="text-text-secondary text-sm">
              Researching and generating your GTD breakdown…
            </p>
          </div>
        )}
      </header>

      {/* Output section — full width */}
      {output && (
        <section
          className="w-full border-t border-[var(--color-border)] bg-[var(--color-surface)]"
          data-generation-options={
            generationOptions ? JSON.stringify(generationOptions) : undefined
          }
        >
          <div className="mx-auto max-w-[1200px] px-6 md:px-12 lg:px-16 py-12">
            {saveNotice && (
              <div
                role="status"
                className="mb-6 flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-text-secondary"
              >
                <span>{saveNotice}</span>
                <button
                  type="button"
                  onClick={() => setSaveNotice("")}
                  className="shrink-0 font-medium text-text-primary underline"
                  aria-label="Dismiss save notice"
                >
                  Dismiss
                </button>
              </div>
            )}

            <OutputPanel ref={outputRef} markdown={output} />

            <div className="mt-6">
              <ActionBar markdown={output} mode={mode} inputText={inputText} />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
