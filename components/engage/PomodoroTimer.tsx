"use client";

import { useEffect, useState } from "react";

const POMODORO_MINUTES = 25;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function PomodoroTimer({
  actionText,
  timeAvailableMinutes,
}: {
  actionText: string;
  timeAvailableMinutes: number;
}) {
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

  const availableMinutes = Math.max(1, Math.min(120, Math.floor(timeAvailableMinutes)));
  const focusMinutes = Math.min(availableMinutes, POMODORO_MINUTES);
  const isComplete = remainingSeconds === 0;

  function start() {
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
      <p className="text-[length:var(--font-size-small)] text-text-secondary">
        {availableMinutes} minutes available. Focus session: {focusMinutes} minutes.
      </p>

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
          className="inline-flex min-h-[44px] w-fit items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start Pomodoro ({focusMinutes} min)
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