"use client";

/**
 * WizardStep4 — the real Step 4 of the goal-creation wizard (Story 3.6),
 * mounted through the shell's step contract (see `GoalWizard.tsx`). It owns ONLY
 * Step 4 content; navigation and gating stay with the shell.
 *
 * What it owns:
 *   - A review summary of every Step 1–3 input: the goal text, the confirmed
 *     framework with each item's required level, the user's rating, and the
 *     computed gap (amber when ≥ 4, mirroring Step 2), the drivers, the
 *     barriers, and the if–then plan. Each section has an "Edit" link that
 *     returns to the relevant step via `ctx.goToStep`.
 *   - "Generate my breakdown": a Pattern C POST to `/api/generate`
 *     `{ mode:'goal', step:'generate', goal, framework, drivers,
 *     barriers, ifThen }`. While in flight the button shows "Generating your
 *     GTD breakdown…" under the endpoint's 30-second timeout. On a 200 `{ id }`
 *     it navigates to `/app/goals/{id}` (the row is already saved server-side,
 *     so the flow never leaves the user on an unsaved result). On error it
 *     stays on Step 4 with all inputs intact, surfaces an inline alert
 *     (`aria-live`), and offers "Try again" that re-runs the same payload.
 *
 * No wizard state is persisted client-side; on failure nothing is written (the
 * server rolls back any partial save), so abandoning writes nothing.
 */

import type { StepContext } from "@/app/app/goals/new/GoalWizard";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Step indices in the shell's STEPS config — kept in sync with GoalWizard. */
const STEP_GOAL = 0;
const STEP_GAP = 1;
const STEP_DRIVERS = 2;

/** Gap threshold at or above which the gap readout turns amber (mirrors Step 2). */
const AMBER_THRESHOLD = 4;

const TIMEOUT_MESSAGE =
  "Generating your breakdown took longer than 30 seconds and timed out. Please try again.";
const NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again.";
const GENERIC_MESSAGE =
  "Something went wrong generating your breakdown. Please try again.";

interface WizardStep4Props {
  ctx: StepContext;
}

export default function WizardStep4({ ctx }: WizardStep4Props) {
  const { state, goToStep, headingRef } = ctx;
  const { goalText, framework, drivers, barriers, ifThen } = state;

  const router = useRouter();
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState("");

  const runGenerate = async () => {
    if (inFlight) return;
    setError("");
    setInFlight(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "goal",
          step: "generate",
          goal: goalText.trim(),
          // `framework` carries each item's `user_rating` inline and is the
          // single source of truth for ratings — the server reads them off
          // `framework`, so no separate `ratings` field is sent.
          framework,
          drivers,
          barriers,
          ifThen,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;

      if (res.ok && payload?.id) {
        // The goal + projects + actions are saved; navigate only now. Keep the
        // form disabled through navigation so a double-submit can't fire.
        router.push(`/app/goals/${payload.id}`);
        router.refresh();
        return;
      }

      if (res.status === 504) {
        setError(payload?.error || TIMEOUT_MESSAGE);
      } else {
        setError(payload?.error || GENERIC_MESSAGE);
      }
      setInFlight(false);
    } catch {
      setError(NETWORK_MESSAGE);
      setInFlight(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-[length:var(--font-size-subheading)] font-bold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        Review &amp; Generate
      </h2>

      <p className="text-[length:var(--font-size-small)] text-text-secondary">
        Review everything below. Use an &ldquo;Edit&rdquo; link to change a
        section, then generate your full GTD breakdown.
      </p>

      {/* Goal */}
      <ReviewSection
        title="Your goal"
        onEdit={() => goToStep(STEP_GOAL)}
        editLabel="Edit goal"
      >
        <p className="text-text-primary">{goalText}</p>
      </ReviewSection>

      {/* Skill framework + ratings */}
      <ReviewSection
        title="Skill framework"
        onEdit={() => goToStep(STEP_GAP)}
        editLabel="Edit ratings"
      >
        {framework && framework.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {framework.map((item, index) => {
              // Step 2 seeds every item's rating to the neutral 5 before Step
              // 4 is reachable, so `user_rating` is always set here; fall back
              // to that same neutral default (never 0, which would show a
              // misleading inflated gap) for defensiveness.
              const rating = item.user_rating ?? 5;
              const gap = Math.max(0, item.required_level - rating);
              const isAmber = gap >= AMBER_THRESHOLD;
              return (
                <li
                  key={`${item.name}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-background p-3"
                >
                  <span className="font-medium text-text-primary">
                    {item.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded-[var(--radius-xs)] bg-primary-subtle px-2 py-0.5 text-[length:var(--font-size-caption)] font-semibold text-primary">
                      Required: {item.required_level}
                    </span>
                    <span className="rounded-[var(--radius-xs)] px-2 py-0.5 text-[length:var(--font-size-caption)] font-semibold text-text-secondary">
                      You: {rating}
                    </span>
                    <span
                      className={`rounded-[var(--radius-xs)] px-2 py-0.5 text-[length:var(--font-size-caption)] font-semibold ${isAmber
                        ? "bg-warning-subtle text-warning"
                        : "text-text-secondary"
                        }`}
                    >
                      Gap: {gap}
                      {isAmber && <span className="sr-only"> (large gap)</span>}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-text-secondary">No framework items.</p>
        )}
      </ReviewSection>

      {/* Drivers */}
      <ReviewSection
        title="Drivers"
        onEdit={() => goToStep(STEP_DRIVERS)}
        editLabel="Edit drivers"
      >
        <ReviewList values={drivers} emptyText="No drivers added." />
      </ReviewSection>

      {/* Barriers */}
      <ReviewSection
        title="Barriers"
        onEdit={() => goToStep(STEP_DRIVERS)}
        editLabel="Edit barriers"
      >
        <ReviewList values={barriers} emptyText="No barriers added." />
      </ReviewSection>

      {/* If–then plan */}
      <ReviewSection
        title="If–then plan"
        onEdit={() => goToStep(STEP_DRIVERS)}
        editLabel="Edit if–then plan"
      >
        <p className="text-text-primary">{ifThen}</p>
      </ReviewSection>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={runGenerate}
          disabled={inFlight}
          aria-disabled={inFlight ? "true" : undefined}
          aria-busy={inFlight ? "true" : undefined}
          className={`flex min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] px-6 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${inFlight
            ? "cursor-not-allowed bg-primary/40 text-white/60"
            : "bg-primary text-white hover:bg-primary-hover motion-safe:transition-colors motion-safe:duration-150"
            }`}
        >
          {inFlight && (
            <span
              className="mr-2 inline-block h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]"
              aria-hidden="true"
            />
          )}
          {inFlight ? "Generating your GTD breakdown…" : "Generate my breakdown"}
        </button>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex flex-col gap-2 rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex items-start gap-2">
              <span aria-hidden="true">⚠</span>
              <span>{error}</span>
            </span>
            <button
              type="button"
              onClick={runGenerate}
              disabled={inFlight}
              className="min-h-[44px] shrink-0 rounded-[var(--radius-sm)] border border-destructive px-4 py-2 font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** A titled review section with an "Edit" affordance returning to a step. */
function ReviewSection({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-text-primary">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[44px] rounded-[var(--radius-sm)] px-3 py-1 text-[length:var(--font-size-small)] font-medium text-primary hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] motion-safe:transition-colors"
        >
          {editLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

/** A simple bulleted list for drivers/barriers, or a fallback when empty. */
function ReviewList({
  values,
  emptyText,
}: {
  values: string[];
  emptyText: string;
}) {
  if (values.length === 0) {
    return <p className="text-text-secondary">{emptyText}</p>;
  }
  return (
    <ul className="flex list-inside list-disc flex-col gap-1 text-text-primary">
      {values.map((value, index) => (
        <li key={`${value}-${index}`}>{value}</li>
      ))}
    </ul>
  );
}
