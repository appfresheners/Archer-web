/**
 * ShutdownFlow (client component) — Story 10.1.
 *
 * Stepper-based shutdown flow with four phases: inbox check, progress review,
 * intention, and termination. Uses Back/Next navigation like the weekly review.
 * Each phase is a separate panel component.
 *
 * Exit link in header returns to Engage without saving. Completing the flow
 * saves to `daily_shutdowns` table and navigates to Engage on success.
 *
 * Intention is optional (500 char limit). Termination phrase "Shutdown complete"
 * is fixed and must be typed exactly to enable completion.
 *
 * Error handling: on save failure (duplicate or network error), show error
 * message with retry option, keeping form state intact.
 */

"use client";

import ShutdownBar from "@/components/shutdown/ShutdownBar";
import InboxCheckPanel from "@/components/shutdown/panels/InboxCheckPanel";
import IntentionPanel from "@/components/shutdown/panels/IntentionPanel";
import ProgressReviewPanel from "@/components/shutdown/panels/ProgressReviewPanel";
import TerminationPanel from "@/components/shutdown/panels/TerminationPanel";
import {
  nextPhase,
  PHASE_COUNT,
  PHASE_LABELS,
  phaseIndex,
  prevPhase,
  type ShutdownPhase,
} from "@/lib/shutdown/phases";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ShutdownFlowProps {
  unprocessedCount: number;
  completedActions: Array<{
    id: string;
    text: string;
    project_name: string | null;
  }>;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

export default function ShutdownFlow({
  unprocessedCount,
  completedActions,
}: ShutdownFlowProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<ShutdownPhase>("inbox_check");
  const [intention, setIntention] = useState("");
  const [terminationInput, setTerminationInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forward = nextPhase(phase);
  const back = prevPhase(phase);
  const positionLabel = `Step ${phaseIndex(phase) + 1} of ${PHASE_COUNT}: ${PHASE_LABELS[phase]}`;

  const isTerminating = phase === "termination";

  async function handleNext() {
    if (!forward || busy) return;
    setPhase(forward);
  }

  async function handleBack() {
    if (!back || busy) return;
    setPhase(back);
  }

  async function handleComplete() {
    if (busy) return;

    setBusy(true);
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
        setBusy(false);
        return;
      }

      // Success — navigate to Engage
      router.push("/app/engage");
    } catch (err) {
      console.error("Failed to save shutdown:", err);
      setError(GENERIC_ERROR);
      setBusy(false);
    }
  }

  function renderPanel() {
    if (phase === "inbox_check") {
      return <InboxCheckPanel unprocessedCount={unprocessedCount} />;
    }
    if (phase === "progress_review") {
      return <ProgressReviewPanel completedActions={completedActions} />;
    }
    if (phase === "intention") {
      return (
        <IntentionPanel
          value={intention}
          onChange={setIntention}
          disabled={busy}
        />
      );
    }
    // termination
    return (
      <TerminationPanel
        value={terminationInput}
        onChange={setTerminationInput}
        onComplete={handleComplete}
        disabled={busy}
        error={error}
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-section-y)]">
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

      <ShutdownBar current={phase} />

      {/* Polite live region: text derived from `phase`, re-rendered on change. */}
      <p aria-live="polite" className="sr-only">
        {positionLabel}
      </p>

      {renderPanel()}

      {/* Back/Next navigation - hidden on termination step where panel has its own completion button */}
      {!isTerminating && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={busy || back === null}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={busy || forward === null}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
      )}

      {/* Back button on termination step */}
      {isTerminating && (
        <div className="flex items-center justify-start">
          <button
            type="button"
            onClick={handleBack}
            disabled={busy || back === null}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
