export default function FocusLoading() {
  return (
    <section
      role="status"
      aria-label="Loading Focus"
      aria-busy="true"
      className="flex flex-col gap-[var(--spacing-section-y)]"
    >
      <span className="sr-only">Loading Focus</span>
      <div className="h-8 w-32 animate-pulse rounded-[var(--radius-sm)] bg-border" />
      <div className="h-56 animate-pulse rounded-[var(--radius-md)] bg-surface" />
      <div className="h-40 animate-pulse rounded-[var(--radius-md)] bg-surface" />
    </section>
  );
}