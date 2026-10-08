import Link from "next/link";
import {
  buildListHref,
  type ListSearchParams,
} from "@/lib/lists/search-pagination";

export default function ListSearch({
  action,
  label,
  query,
  searchParams,
  queryKey = "q",
  pageKey = "page",
}: {
  action: string;
  label: string;
  query: string;
  searchParams: ListSearchParams;
  queryKey?: string;
  pageKey?: string;
}) {
  const clearHref = buildListHref(action, searchParams, {
    [queryKey]: null,
    [pageKey]: null,
  });

  return (
    <div className="flex flex-col gap-2">
      <form action={action} method="get" className="flex flex-wrap items-end gap-2">
        {Object.entries(searchParams).flatMap(([key, value]) => {
          if (key === queryKey || key === pageKey || value === undefined) return [];
          return (Array.isArray(value) ? value : [value]).map((item, index) => (
            <input
              key={`${key}-${index}`}
              type="hidden"
              name={key}
              value={item}
            />
          ));
        })}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label
            htmlFor={`${queryKey}-search`}
            className="text-[length:var(--font-size-small)] font-medium text-text-secondary"
          >
            {label}
          </label>
          <input
            id={`${queryKey}-search`}
            type="search"
            name={queryKey}
            defaultValue={query}
            className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Search
        </button>
      </form>
      {query && (
        <Link
          href={clearHref}
          className="inline-flex min-h-[44px] w-fit items-center text-[length:var(--font-size-small)] font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Clear search
        </Link>
      )}
    </div>
  );
}