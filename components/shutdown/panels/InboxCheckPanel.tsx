/**
 * InboxCheckPanel — the inbox check step of the daily shutdown (Story 10.1).
 *
 * Shows unprocessed inbox count with visual feedback (checkmark if zero, info
 * icon otherwise) and a link to process inbox if needed.
 */

import Link from "next/link";

interface InboxCheckPanelProps {
  unprocessedCount: number;
}

export default function InboxCheckPanel({
  unprocessedCount,
}: InboxCheckPanelProps) {
  return (
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
    </div>
  );
}
