import Link from "next/link";

export interface MonthlyGoalCheckPromptGoal {
  id: string;
  goal_text: string;
}

export default function MonthlyGoalCheckPrompt({
  goals,
}: {
  goals: MonthlyGoalCheckPromptGoal[];
}) {
  if (goals.length === 0) return null;

  return (
    <aside
      aria-label="Monthly goal checks due"
      className="mb-6 flex flex-col gap-2 rounded-[var(--radius-md)] border border-warning bg-warning-subtle p-[var(--spacing-card-p)]"
    >
      <h2 className="font-semibold text-text-primary">
        Monthly goal check due
      </h2>
      <p className="text-[length:var(--font-size-small)] text-text-secondary">
        Take a moment to review these active goals.
      </p>
      <ul className="flex flex-col gap-1">
        {goals.map((goal) => (
          <li key={goal.id}>
            <Link
              href={`/app/review/monthly/${goal.id}`}
              className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              {goal.goal_text}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}