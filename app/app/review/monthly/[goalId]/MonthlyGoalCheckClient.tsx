"use client";

import GoalStatusSelect from "@/components/goals/GoalStatusSelect";
import type { GoalStatus } from "@/lib/supabase/schema";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface MonthlyCheckClientGoal {
  id: string;
  goal_text: string;
  status: GoalStatus;
}

const RELEVANCE_OPTIONS = [
  { value: "yes", label: "Yes, it is still relevant" },
  { value: "no", label: "No, it is no longer relevant" },
  { value: "changed", label: "Changed, it needs to be reframed" },
] as const;

export default function MonthlyGoalCheckClient({
  goal,
}: {
  goal: MonthlyCheckClientGoal;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(goal.status);
  const [relevance, setRelevance] = useState("");
  const [missingProject, setMissingProject] = useState("");
  const [overloaded, setOverloaded] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleStatusChange(nextStatus: GoalStatus) {
    if (nextStatus === status || busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(payload?.error || "Could not update the goal status.");
        return;
      }
      setStatus(nextStatus);
      router.refresh();
    } catch {
      setError("Could not update the goal status.");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (busy) return;
    if (!relevance) {
      setError("Choose whether this goal is still relevant before completing the check.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/goals/${goal.id}/monthly-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relevance }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(payload?.error || "Could not complete the goal check.");
        return;
      }
      router.push(`/app/goals/${goal.id}`);
      router.refresh();
    } catch {
      setError("Could not complete the goal check.");
    } finally {
      setBusy(false);
    }
  }

  const fieldsetClass = "flex flex-col gap-2";
  const optionClass = "flex min-h-[44px] items-center gap-3 text-text-primary";

  return (
    <section className="flex flex-col gap-5 border-t border-border pt-5">
      <fieldset className={fieldsetClass}>
        <legend className="mb-1 text-[length:var(--font-size-subheading)] font-semibold text-text-primary">
          Is this goal still relevant?
        </legend>
        {RELEVANCE_OPTIONS.map((option) => (
          <label key={option.value} className={optionClass}>
            <input
              type="radio"
              name="goal-relevance"
              value={option.value}
              checked={relevance === option.value}
              onChange={() => {
                setRelevance(option.value);
                setError("");
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="monthly-goal-status"
          className="font-medium text-text-primary"
        >
          Goal status
        </label>
        <GoalStatusSelect
          id="monthly-goal-status"
          value={status}
          onChange={handleStatusChange}
          disabled={busy}
        />
      </div>

      <fieldset className={fieldsetClass}>
        <legend className="font-medium text-text-primary">
          Is a project missing for this goal?
        </legend>
        {["yes", "no"].map((value) => (
          <label key={value} className={optionClass}>
            <input
              type="radio"
              name="missing-project"
              value={value}
              checked={missingProject === value}
              onChange={() => setMissingProject(value)}
            />
            {value === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className="font-medium text-text-primary">
          Does this goal feel overloaded?
        </legend>
        {["yes", "no"].map((value) => (
          <label key={value} className={optionClass}>
            <input
              type="radio"
              name="goal-overloaded"
              value={value}
              checked={overloaded === value}
              onChange={() => setOverloaded(value)}
            />
            {value === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </fieldset>

      {error && (
        <p role="alert" aria-live="assertive" className="text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleComplete}
        disabled={busy}
        className="inline-flex min-h-[44px] w-fit items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Completing…" : "Complete monthly check"}
      </button>
    </section>
  );
}