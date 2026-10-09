import Link from "next/link";
import {
  buildListHref,
  type ListSearchParams,
} from "@/lib/lists/search-pagination";

function pageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  return [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

export default function Pagination({
  action,
  page,
  total,
  searchParams,
  pageKey = "page",
  pageSize = 20,
}: {
  action: string;
  page: number;
  total: number;
  searchParams: ListSearchParams;
  pageKey?: string;
  pageSize?: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  const pages = pageNumbers(page, totalPages);
  const hrefForPage = (targetPage: number) =>
    buildListHref(action, searchParams, { [pageKey]: targetPage });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[length:var(--font-size-small)] text-text-secondary" aria-live="polite">
        Showing {firstItem}-{lastItem} of {total}
      </p>
      <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
        {page > 1 ? (
          <Link
            href={hrefForPage(page - 1)}
            aria-label="Previous page"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-border-strong px-3 text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Previous
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Previous page"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-border px-3 text-text-secondary opacity-60"
          >
            Previous
          </span>
        )}
        {pages.map((number, index) => {
          const previous = pages[index - 1];
          return (
            <span key={number} className="contents">
              {previous !== undefined && number - previous > 1 && (
                <span aria-hidden="true" className="px-1 text-text-secondary">
                  ...
                </span>
              )}
              <Link
                href={hrefForPage(number)}
                aria-label={`Go to page ${number}`}
                aria-current={number === page ? "page" : undefined}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-border-strong px-3 text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] aria-[current=page]:border-primary aria-[current=page]:bg-primary-subtle aria-[current=page]:font-semibold"
              >
                {number}
              </Link>
            </span>
          );
        })}
        {page < totalPages ? (
          <Link
            href={hrefForPage(page + 1)}
            aria-label="Next page"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-border-strong px-3 text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Next
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Next page"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-border px-3 text-text-secondary opacity-60"
          >
            Next
          </span>
        )}
      </nav>
    </div>
  );
}