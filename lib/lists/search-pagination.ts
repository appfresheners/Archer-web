export const LIST_PAGE_SIZE = 20;
const MAX_SAFE_PAGE = Math.floor(Number.MAX_SAFE_INTEGER / LIST_PAGE_SIZE);

export type ListSearchParams = Record<
  string,
  string | string[] | undefined
>;

export interface ListQueryState {
  query: string;
  page: number;
}

export function parseListQuery(
  params: ListSearchParams,
  queryKey = "q",
  pageKey = "page",
): ListQueryState {
  const rawQuery = params[queryKey];
  const rawPage = params[pageKey];
  const queryValue = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
  const pageValue = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const parsedPage = pageValue && /^\d+$/.test(pageValue) ? Number(pageValue) : 1;
  const safePage =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return {
    query: (queryValue ?? "").trim(),
    page: Math.min(safePage, MAX_SAFE_PAGE),
  };
}

export function escapeIlikePattern(query: string): string {
  const escaped = query.replace(/[\\%_]/g, "\\$&");
  return `%${escaped}%`;
}

export function escapePostgrestFilterValue(value: string): string {
  return value.replace(/[\\"]/g, "\\$&");
}

export function getPageRange(page: number, pageSize = LIST_PAGE_SIZE) {
  return {
    from: (page - 1) * pageSize,
    to: page * pageSize - 1,
  };
}

export function clampPage(page: number, total: number, pageSize = LIST_PAGE_SIZE) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(page, 1), lastPage);
}

export function buildListHref(
  path: string,
  currentParams: ListSearchParams,
  updates: Record<string, string | number | null>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(currentParams)) {
    if (Object.hasOwn(updates, key) || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, item);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value !== null) params.append(key, String(value));
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}