"use client";

/**
 * ClarifyWizard — the branching GTD clarify/organize flow for a single inbox
 * item (Story 5.2). Opened at `/app/inbox/[id]`.
 *
 * Unlike the linear GoalWizard (fixed `STEPS[]`), clarify is a DECISION TREE.
 * We reuse GoalWizard's mechanics — an `answers` object, gated advance/back,
 * a one-shot focus ref + `useLayoutEffect` focus move — but the *current
 * question* and the stepper's *visited trail* are DERIVED from the answers,
 * not from `currentIndex + 1`.
 *
 * The canonical flow:
 *   1. What is it?            (acknowledge the item)
 *   2. Is it actionable?
 *        No  → Trash | Someday | Reference          → PATCH terminal status
 *        Yes → 3.
 *   3. Is it a multistep project?
 *        Yes → route to the project creator (seeded)  → link happens on create
 *        No  → 4.
 *   4. Will it take < 2 minutes?
 *        Yes → "Do it"                                → PATCH processed (no row)
 *        No  → 5.
 *   5. Organize:
 *        Next action  → POST standalone action        → PATCH processed
 *        Delegate     → delegated_to → POST waiting     → PATCH processed
 *        Defer/Calendar → date → POST scheduled action → PATCH processed
 *
 * The three-node stepper ("What is it", "Actionable?", "Organize") stays
 * legible; micro-questions live inside the "Organize" node.
 *
 * Purity/lint notes (repo enforces react-hooks/set-state-in-effect and
 * react-hooks/purity): state updaters are pure, focus is moved only via a
 * one-shot ref inside `useLayoutEffect`, and `Date`/`fetch` are never called
 * during render.
 */

import WizardStepper from "@/components/goals/WizardStepper";
import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/** The high-level stepper nodes (not one per micro-question). */
const STEPPER_NODES = [
  { id: "what", label: "What is it" },
  { id: "actionable", label: "Actionable?" },
  { id: "organize", label: "Organize" },
] as const;

/** Which stepper node a question belongs under. */
type NodeId = (typeof STEPPER_NODES)[number]["id"];

/** The distinct questions/screens in the tree. */
type Question =
  | "what" // 1
  | "actionable" // 2
  | "nonActionable" // 2a: Trash / Someday / Reference
  | "multistep" // 3
  | "twoMinute" // 4
  | "organize" // 5: choose Next action / Delegate / Defer
  | "delegate" // 5a: enter delegated_to
  | "calendar" // 5b: pick a date
  | "nextAction"; // 5c: confirm a standalone next action

const QUESTION_NODE: Record<Question, NodeId> = {
  what: "what",
  actionable: "actionable",
  nonActionable: "actionable",
  multistep: "organize",
  twoMinute: "organize",
  organize: "organize",
  delegate: "organize",
  calendar: "organize",
  nextAction: "organize",
};

export interface ClarifyItem {
  id: string;
  raw_text: string;
}

interface ClarifyWizardProps {
  item: ClarifyItem;
  /** Owned projects for the (optional) assign-to-project affordance. */
  projects?: { id: string; name: string }[];
}

/** Map a stepper node id to its index for the presentational stepper. */
function nodeIndex(node: NodeId): number {
  return STEPPER_NODES.findIndex((n) => n.id === node);
}

export default function ClarifyWizard({ item, projects = [] }: ClarifyWizardProps) {
  const router = useRouter();

  // The path taken through the tree. `trail[0]` is always "what"; the last
  // element is the current question. A back-stack (not index math) is required
  // because the tree branches. `question` is derived, never stored separately.
  const [trail, setTrail] = useState<Question[]>(["what"]);
  const question = trail[trail.length - 1];

  const [delegatedTo, setDelegatedTo] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [projectId, setProjectId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // If the action POST succeeds but the follow-up inbox PATCH fails, the action
  // row already exists. Remember it so a retry marks the item processed instead
  // of creating a DUPLICATE action.
  const createdActionRef = useRef(false);

  // Focus management mirrors GoalWizard: move focus to the panel heading after
  // a navigation only (never on mount/typing), guarded by a one-shot ref.
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const shouldFocusRef = useRef(false);

  const goTo = useCallback((next: Question) => {
    shouldFocusRef.current = true;
    setError("");
    setTrail((prev) => [...prev, next]);
  }, []);

  const back = useCallback(() => {
    shouldFocusRef.current = true;
    setError("");
    // Never pop below the root "what" step.
    setTrail((prev) => (prev.length <= 1 ? prev : prev.slice(0, -1)));
  }, []);

  useLayoutEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    headingRef.current?.focus();
  }, [question]);

  // --- API calls -----------------------------------------------------------

  /** PATCH the inbox item to a terminal status; navigate to inbox on success. */
  const finishInbox = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      const res = await fetch(`/api/inbox/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        return false;
      }
      return true;
    },
    [item.id],
  );

  /** POST a new action; returns true on success. */
  const createAction = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      const res = await fetch(`/api/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        return false;
      }
      return true;
    },
    [],
  );

  const navigateToInbox = useCallback(() => {
    router.push("/app/inbox");
    router.refresh();
  }, [router]);

  // Terminal: mark the item with a non-actionable status (trash/someday/ref)
  // or a plain "processed" (the <2min "Do it" outcome — no action row).
  const runTerminalStatus = useCallback(
    async (status: "processed" | "trashed" | "someday" | "reference") => {
      if (submitting) return;
      setSubmitting(true);
      setError("");
      const ok = await finishInbox({ status });
      if (ok) {
        navigateToInbox();
        return;
      }
      setSubmitting(false);
    },
    [submitting, finishInbox, navigateToInbox],
  );

  // Terminal: create a standalone action (next / waiting / scheduled), then
  // mark the item processed. If the action fails, the item is left untouched.
  const runCreateThenProcess = useCallback(
    async (actionBody: Record<string, unknown>) => {
      if (submitting) return;
      setSubmitting(true);
      setError("");
      // Skip re-creating the action on a retry: if a prior attempt already
      // created it (and only the inbox PATCH failed), just finish the item.
      if (!createdActionRef.current) {
        const created = await createAction(actionBody);
        if (!created) {
          setSubmitting(false);
          return;
        }
        createdActionRef.current = true;
      }
      const ok = await finishInbox({ status: "processed" });
      if (ok) {
        navigateToInbox();
        return;
      }
      // Action exists but the item is still unprocessed; the createdActionRef
      // guard ensures the next attempt only retries the PATCH.
      setSubmitting(false);
    },
    [submitting, createAction, finishInbox, navigateToInbox],
  );

  // Multistep: hand off to the project creator, seeded with the item text.
  // The creator links the item (resolved_project_id + processed) on create.
  const goToProjectCreator = useCallback(() => {
    const params = new URLSearchParams({
      from_inbox: item.id,
      seed: item.raw_text,
    });
    router.push(`/app/projects/new?${params.toString()}`);
  }, [item.id, item.raw_text, router]);

  // --- Derived stepper state -------------------------------------------------

  const activeNode = QUESTION_NODE[question];
  const currentIndex = nodeIndex(activeNode);
  // A node is complete once we've moved past it in the trail.
  const completedIndices = STEPPER_NODES.map((_, i) => i).filter(
    (i) => i < currentIndex,
  );

  const canDelegate = delegatedTo.trim().length > 0;
  const canSchedule = scheduledFor.trim().length > 0;

  // --- Rendering -------------------------------------------------------------

  // A plain JSX helper (not a nested component) for the focusable step heading
  // so the `headingRef` attaches to whatever question is currently rendered.
  const heading = (text: string) => (
    <h2
      ref={headingRef}
      tabIndex={-1}
      className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
    >
      {text}
    </h2>
  );

  const choiceBtn =
    "inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";
  const primaryBtn =
    "inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-bold text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

  function renderQuestion() {
    switch (question) {
      case "what":
        return (
          <div className="flex flex-col gap-4">
            {heading("What is it?")}
            <p className="whitespace-pre-wrap break-words rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)] text-text-primary">
              {item.raw_text}
            </p>
            <p className="text-text-secondary">
              Read the item, then clarify what it really is.
            </p>
            <div>
              <button type="button" className={primaryBtn} onClick={() => goTo("actionable")}>
                Next: Is it actionable? →
              </button>
            </div>
          </div>
        );

      case "actionable":
        return (
          <div className="flex flex-col gap-4">
            {heading("Is it actionable?")}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryBtn} onClick={() => goTo("multistep")}>
                Yes, it&apos;s actionable
              </button>
              <button type="button" className={choiceBtn} onClick={() => goTo("nonActionable")}>
                No, not actionable
              </button>
            </div>
          </div>
        );

      case "nonActionable":
        return (
          <div className="flex flex-col gap-4">
            {heading("Not actionable — where does it go?")}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={choiceBtn}
                disabled={submitting}
                onClick={() => runTerminalStatus("trashed")}
              >
                Trash
              </button>
              <button
                type="button"
                className={choiceBtn}
                disabled={submitting}
                onClick={() => runTerminalStatus("someday")}
              >
                Someday / Maybe
              </button>
              <button
                type="button"
                className={choiceBtn}
                disabled={submitting}
                onClick={() => runTerminalStatus("reference")}
              >
                Reference
              </button>
            </div>
          </div>
        );

      case "multistep":
        return (
          <div className="flex flex-col gap-4">
            {heading("Is it a multistep project?")}
            <p className="text-text-secondary">
              A project is anything that needs more than one action to finish.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryBtn}
                disabled={submitting}
                onClick={goToProjectCreator}
              >
                Yes, it&apos;s a project
              </button>
              <button type="button" className={choiceBtn} onClick={() => goTo("twoMinute")}>
                No, a single action
              </button>
            </div>
          </div>
        );

      case "twoMinute":
        return (
          <div className="flex flex-col gap-4">
            {heading("Will it take less than 2 minutes?")}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryBtn}
                disabled={submitting}
                onClick={() => runTerminalStatus("processed")}
              >
                Do it now
              </button>
              <button type="button" className={choiceBtn} onClick={() => goTo("organize")}>
                No, it takes longer
              </button>
            </div>
          </div>
        );

      case "organize":
        return (
          <div className="flex flex-col gap-4">
            {heading("Organize this action")}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={choiceBtn} onClick={() => goTo("nextAction")}>
                Next action
              </button>
              <button type="button" className={choiceBtn} onClick={() => goTo("delegate")}>
                Delegate (waiting on someone)
              </button>
              <button type="button" className={choiceBtn} onClick={() => goTo("calendar")}>
                Defer to a date
              </button>
            </div>
          </div>
        );

      case "nextAction":
        return (
          <div className="flex flex-col gap-4">
            {heading("Add as a next action")}
            {projects.length > 0 && (
              <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] text-text-secondary">
                Project (optional)
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="min-h-[44px] rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                >
                  <option value="">No project (standalone)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div>
              <button
                type="button"
                className={primaryBtn}
                disabled={submitting}
                onClick={() =>
                  runCreateThenProcess({
                    text: item.raw_text,
                    status: "available",
                    project_id: projectId || null,
                  })
                }
              >
                Create next action
              </button>
            </div>
          </div>
        );

      case "delegate":
        return (
          <div className="flex flex-col gap-4">
            {heading("Who are you waiting on?")}
            <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] text-text-secondary">
              Waiting on
              <input
                type="text"
                value={delegatedTo}
                onChange={(e) => setDelegatedTo(e.target.value)}
                placeholder="e.g. Sam"
                className="min-h-[44px] rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              />
            </label>
            <div>
              <button
                type="button"
                className={primaryBtn}
                disabled={submitting || !canDelegate}
                onClick={() =>
                  runCreateThenProcess({
                    text: item.raw_text,
                    status: "waiting",
                    delegated_to: delegatedTo.trim(),
                  })
                }
              >
                Create waiting action
              </button>
            </div>
          </div>
        );

      case "calendar":
        return (
          <div className="flex flex-col gap-4">
            {heading("Defer to a date")}
            <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] text-text-secondary">
              Scheduled date
              <input
                type="date"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="min-h-[44px] rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              />
            </label>
            <div>
              <button
                type="button"
                className={primaryBtn}
                disabled={submitting || !canSchedule}
                onClick={() =>
                  runCreateThenProcess({
                    text: item.raw_text,
                    status: "available",
                    scheduled_for: scheduledFor,
                  })
                }
              >
                Schedule action
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-section-y)]">
      <WizardStepper
        steps={STEPPER_NODES.map((n) => ({ id: n.id, label: n.label }))}
        currentIndex={currentIndex}
        completedIndices={completedIndices}
        ariaLabel="Clarify progress"
      />

      <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-[var(--spacing-card-p)]">
        {renderQuestion()}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-4 rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
          >
            {error}
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={back}
          disabled={trail.length <= 1 || submitting}
          className="min-h-[44px] rounded-[var(--radius-sm)] border border-border px-6 py-2 font-medium text-text-primary hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 motion-safe:transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}
