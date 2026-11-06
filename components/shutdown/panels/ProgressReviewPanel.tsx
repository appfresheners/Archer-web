/**
 * ProgressReviewPanel — today's progress review step of the daily shutdown
 * (Story 10.1).
 *
 * Displays completed actions for today grouped with a visual indicator.
 * Shows empty state if no actions were completed.
 */

interface ProgressReviewPanelProps {
  completedActions: Array<{
    id: string;
    text: string;
    project_name: string | null;
  }>;
}

export default function ProgressReviewPanel({
  completedActions,
}: ProgressReviewPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
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
    </div>
  );
}
