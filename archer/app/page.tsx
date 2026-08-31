"use client";

import ActionBar from "@/components/ActionBar";
import InputSection from "@/components/InputSection";
import ModeToggle from "@/components/ModeToggle";
import OutputPanel from "@/components/OutputPanel";
import { saveEntry } from "@/lib/vault/storage";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"goal" | "project">("goal");
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  const handleModeChange = (newMode: "goal" | "project") => {
    setMode(newMode);
    setInputText("");
    setOutput("");
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

      // Persist the breakdown to the local vault. A save failure must never
      // clear the visible output — it only raises a dismissible notice.
      const saved = saveEntry({
        inputText,
        mode,
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

  return (
    <main className="min-h-screen">
      {/* Input section — centered and narrow */}
      <header className="mx-auto max-w-[640px] px-[var(--spacing-page-x)] lg:px-[var(--spacing-page-x-lg)] py-[var(--spacing-section-y)]">
        <h1 className="text-[length:var(--font-size-hero)] font-bold text-text-primary">
          Archer
        </h1>
        <p className="mt-2 text-text-secondary">
          Type a goal. Get the next actions.
        </p>

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
        <section className="w-full border-t border-[var(--color-border)] bg-[var(--color-surface)]">
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
