/**
 * ShutdownFlow (client component) — Story 10.1.
 *
 * Vertical single-page shutdown flow with four sections: inbox check, today's
 * progress, tomorrow's intention, and termination phrase. All sections are
 * visible on one scrollable page (no wizard/steps). Each section has a
 * "Continue" button that smooth-scrolls to the next section.
 *
 * Exit link in header returns to Engage without saving. Completing the flow
 * saves to `daily_shutdowns` table and navigates to Engage on success.
 *
 * Intention is optional (500 char limit). Termination phrase "Shutdown complete"
 * is fixed and must be typed exactly to enable the Done button.
 *
 * Error handling: on save failure (duplicate or network error), show error
 * message with retry option, keeping form state intact.
 */

"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface ShutdownFlowProps {
  unprocessedCount: number;
  completedActions: Array<{
    id: string;
    text: string;
    project_name: string | null;
  }>;
}

const TERMINATION_PHRASE = "Shutdown complete";
const MAX_INTENTION_LENGTH = 500;

export default function ShutdownFlow({
  unprocessedCount,
  completedActions,
}: ShutdownFlowProps) {
  const router = useRouter();
  const [intention, setIntention] = useState("");
  const [terminationInput, setTerminationInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progressRef = useRef<HTMLDivElement>(null);
  const intentionRef = useRef<HTMLDivElement>(null);
  const phraseRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const isTerminationValid = terminationInput.trim() === TERMINATION_PHRASE;

  const handleSave = async () => {
    if (!isTerminationValid) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: insertError } = await supabase
        .from("daily_shutdowns")
        .insert({
          user_id: user.id,
          intention: intention.trim() ? intention.trim().slice(0, 500) : null,
        });

      if (insertError) {
        // Check for unique constraint violation
        if (insertError.code === "23505") {
          setError("Already completed shutdown today.");
        } else {
          throw insertError;
        }
        setSaving(false);
        return;
      }

      // Success — navigate to Engage
      router.push("/app/engage");
    } catch (err) {
      console.error("Failed to save shutdown:", err);
      setError("Failed to save shutdown. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Daily Shutdown
        </h1>
        <Link
          href="/app/engage"
          className="text-[length:var(--font-size-small)] text-text-secondary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] hover:text-text-primary"
        >
          Exit
        </Link>
      </header>

      {/* Section 1: Inbox Check */}
      <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
        <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
          Inbox Check
        </h2>
        <div className="flex items-center gap-3">
          {unprocessedCount === 0 ? (
            <>
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-primary"
                aria-hidden="true"
              >
                <circle cx={12} cy={12} r={10} />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <p className="text-text-primary">
                Unprocessed: <strong>0 items</strong>
              </p>
            </>
          ) : (
            <>
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-text-secondary"
                aria-hidden="true"
              >
                <circle cx={12} cy={12} r={10} />
                <path d="m12 8 0 4" />
                <path d="m12 16 0 .01" />
              </svg>
              <p className="text-text-primary">
                Unprocessed: <strong>{unprocessedCount} items</strong>
              </p>
              <Link
                href="/app/inbox"
                className="ml-auto text-[length:var(--font-size-small)] text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] hover:text-primary-hover"
              >
                Process inbox
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => scrollToSection(progressRef)}
          className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-primary px-[var(--spacing-button-px)] py-[var(--spacing-button-py)] text-[length:var(--font-size-body)] font-medium text-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] motion-safe:transition-colors motion-safe:duration-150 hover:bg-primary-hover"
        >
          Continue
        </button>
      </div>

      {/* Section 2: Today's Progress */}
      <div
        ref={progressRef}
        className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]"
      >
        <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
          Today&apos;s Progress
        </h2>
        {completedActions.length === 0 ? (
          <p className="text-text-secondary">No actions completed today.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {completedActions.map((action) => (
              <li
                key={action.id}
                className="flex flex-col gap-1 border-l-2 border-primary pl-3"
              >
                <p className="text-text-primary">{action.text}</p>
                {action.project_name && (
                  <p className="text-[length:var(--font-size-small)] text-text-secondary">
                    {action.project_name}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => scrollToSection(intentionRef)}
          className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-primary px-[var(--spacing-button-px)] py-[var(--spacing-button-py)] text-[length:var(--font-size-body)] font-medium text-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] motion-safe:transition-colors motion-safe:duration-150 hover:bg-primary-hover"
        >
          Continue
        </button>
      </div>

      {/* Section 3: Tomorrow's Intention */}
      <div
        ref={intentionRef}
        className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
            Tomorrow&apos;s Intention
          </h2>
          <p className="text-[length:var(--font-size-small)] text-text-secondary">
            Optional — What matters most tomorrow? (Max 500 characters)
          </p>
        </div>
        <textarea
          value={intention}
          onChange={(e) => {
            if (e.target.value.length <= MAX_INTENTION_LENGTH) {
              setIntention(e.target.value);
            }
          }}
          placeholder="e.g., Ship the proposal review by noon, then focus on the client call prep..."
          rows={4}
          className="w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 py-2 text-[length:var(--font-size-body)] text-text-primary placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        />
        <p className="text-[length:var(--font-size-small)] text-text-secondary">
          {intention.length} / {MAX_INTENTION_LENGTH} characters
        </p>
        <button
          type="button"
          onClick={() => scrollToSection(phraseRef)}
          className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-primary px-[var(--spacing-button-px)] py-[var(--spacing-button-py)] text-[length:var(--font-size-body)] font-medium text-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] motion-safe:transition-colors motion-safe:duration-150 hover:bg-primary-hover"
        >
          Continue
        </button>
      </div>

      {/* Section 4: Termination Phrase */}
      <div
        ref={phraseRef}
        className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
            Complete Shutdown
          </h2>
          <p className="text-[length:var(--font-size-small)] text-text-secondary">
            Say it aloud: &ldquo;<strong>{TERMINATION_PHRASE}</strong>&rdquo;
          </p>
        </div>
        <input
          type="text"
          value={terminationInput}
          onChange={(e) => setTerminationInput(e.target.value)}
          placeholder="Then type it here to confirm"
          className="w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 py-2 text-[length:var(--font-size-body)] text-text-primary placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        />

        {error && (
          <div className="rounded-[var(--radius-sm)] border border-red-600 bg-red-50 p-3 text-red-800">
            <p className="text-[length:var(--font-size-small)]">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!isTerminationValid || saving}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-primary px-[var(--spacing-button-px)] py-[var(--spacing-button-py)] text-[length:var(--font-size-body)] font-medium text-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] motion-safe:transition-colors motion-safe:duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Done"}
        </button>
      </div>
    </div>
  );
}
