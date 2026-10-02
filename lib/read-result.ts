/**
 * Discriminated result for server-side data reads.
 *
 * Read surfaces distinguish a transient backend/network failure (`error`) from
 * genuinely missing data (`not-found`) and a successful read (`ok`). List pages
 * only ever produce `ok` (possibly with an empty list) or `error`; detail pages
 * may additionally produce `not-found` for a missing/non-owned id.
 */
export type ReadResult<T> =
    | { status: "ok"; data: T }
    | { status: "not-found" }
    | { status: "error" };

/**
 * Discriminated result for list reads, which never distinguish "not-found"
 * from "empty" — an empty list is a valid `ok` result.
 */
export type ReadListResult<T> =
    | { status: "ok"; data: T }
    | { status: "error" };
