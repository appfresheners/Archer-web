"use client";

import { useEffect, useState } from "react";

const POMODORO_MINUTES = 25;
const MAX_AVAILABLE_MINUTES = 120;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function PomodoroTimer({ actionText }: { actionText: string }) {
  const [availableMinutes, setAvailableMinutes] = useState("25");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");

  useEffect(() => {
    if (status !== "running" || remainingSeconds === null || remainingSeconds === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((current) =>
        current === null ? null : Math.max(0, current - 1),
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, [remainingSeconds, status]);

  const parsedAvailableMinutes = Number(availableMinutes);
  const validAvailableMinutes =
    Number.isInteger(parsedAvailableMinutes) &&
    parsedAvailableMinutes >= 1 &&
    parsedAvailableMinutes <= MAX_AVAILABLE_MINUTES;
  const focusMinutes = validAvailableMinutes
    ? Math.min(parsedAvailableMinutes, POMODORO_MINUTES)
    : null;
  const isComplete = remainingSeconds === 0;

  function start() {
    if (focusMinutes === null) return;
    setRemainingSeconds(focusMinutes * 60);
    setStatus("running");
  }

  function reset() {
    setRemainingSeconds(null);
    setStatus("idle");
  }

  return (
    <section
      aria-label={`Focus timer for ${actionText}`}
      className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-border bg-surface p-3"
    >
      <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-primary">
        Time available (minutes)
        <input
          type="number"
          min={1}
          max={MAX_AVAILABLE_MINUTES}
          step={1}
          value={availableMinutes}
          disabled={status !== "idle"}
          onChange={(event) => setAvailableMinutes(event.target.value)}
          className="min-h-[44px] w-28 rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
        />
      </label>

      {remainingSeconds !== null && (
        <p role="timer" aria-label="Time remaining" className="font-mono text-3xl font-semibold text-text-primary">
          {formatTime(remainingSeconds)}
        </p>
      )}

      {isComplete ? (
        <p role="status" className="text-text-secondary">Pomodoro complete.</p>
      ) : status === "idle" ? (
        <button
          type="button"
          onClick={start}
          disabled={focusMinutes === null}
          className="inline-flex min-h-[44px] w-fit items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start Pomodoro{focusMinutes === null ? "" : ` (${focusMinutes} min)`}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatus(status === "running" ? "paused" : "running")}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {status === "running" ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Reset
          </button>
        </div>
      )}
    </section>
  );
}