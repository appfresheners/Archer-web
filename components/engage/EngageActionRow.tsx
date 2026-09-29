"use client";

/**
 * EngageActionRow — one committed next-action row in the Engage view (Story 5.3).
 *
 * Presentational: shows the action text, its context-tag chips (reusing the
 * exact chip markup from `ActionItem`), the parent project name (omitted for
 * standalone "Anytime" rows), and a Done button. The Done button is 44px-min
 * for touch. All behavior (mark done → prompt / refresh) is owned by the
 * parent `EngageBoard`; this row only reports the click.
 */

import type { EngageRow } from "@/lib/engage/model";

export interface EngageActionRowProps {
  row: EngageRow;
  disabled?: boolean;
  onDone: (row: EngageRow) => void;
}

export default function EngageActionRow({
  row,
  disabled,
  onDone,
}: EngageActionRowProps) {
  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-text-primary">{row.text}</span>

        {row.context_tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {row.context_tags.map((tag) => (
              <li
                key={tag}
                className="rounded-[var(--radius-xs)] bg-surface px-2 py-0.5 text-[length:var(--font-size-caption)] text-text-secondary"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        {row.projectName && (
          <span className="text-[length:var(--font-size-small)] text-text-secondary">
            {row.projectName}
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onDone(row)}
        aria-label={`Mark "${row.text}" done`}
        className="inline-flex min-h-[44px] w-fit shrink-0 items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:border-primary hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Done
      </button>
    </li>
  );
}
