/**
 * Pure extractor for the denormalized `projects` columns.
 *
 * The full generated markdown is always persisted verbatim as `breakdown_md`
 * (the single source of truth). This helper pulls the H1 title and the
 * `## Purpose` / `## Successful Outcome` section bodies into their own columns
 * so list/detail views can show them without re-parsing the whole document.
 *
 * It is deliberately hand-rolled (no markdown dependency) and tolerant:
 *   - It reads the FIRST H1 (`# `) as the name.
 *   - It reads a level-2 section (`## Heading`) body as the text between that
 *     heading and the next `## ` heading of the same level (nested `###`
 *     sub-headings inside a section — e.g. Full-GTD's `### Principles` — are
 *     kept as part of the enclosing section body, not treated as boundaries).
 *   - Missing sections fall back to sensible values: an absent name falls back
 *     to `fallbackName` (typically the input-derived name); an absent Purpose
 *     or Successful Outcome falls back to an empty string.
 *
 * No side effects; safe to call in tests and on the server.
 */

export interface ParsedProjectBreakdown {
  name: string;
  purpose: string;
  successful_outcome: string;
}

/**
 * Extract the text of the first `# ` (H1) heading, or null if none.
 * Strips optional ATX closing hashes (`# Title #`) so they never leak into the
 * stored name.
 */
function extractH1(lines: string[]): string | null {
  for (const line of lines) {
    const match = /^#\s+(.+?)\s*$/.exec(line);
    if (match) {
      // Drop trailing ATX close hashes, e.g. "Title ###" -> "Title".
      return match[1].replace(/\s+#+\s*$/, "").trim();
    }
  }
  return null;
}

/**
 * The `projects.name` column enforces `char_length between 1 and 200`. Clamp
 * the parsed name to that ceiling so a long H1 degrades to a truncated name
 * rather than failing the whole insert (the full title survives in
 * `breakdown_md`). Truncation trims and appends an ellipsis within the cap.
 */
const NAME_MAX_LEN = 200;

function clampName(name: string): string {
  if (name.length <= NAME_MAX_LEN) {
    return name;
  }
  return `${name.slice(0, NAME_MAX_LEN - 1).trimEnd()}…`;
}

/**
 * Extract the body of a `## Heading` section — everything after the heading up
 * to (but not including) the next `## ` heading or end of document. Nested
 * `### ` sub-headings are preserved inside the body. Matching is
 * case-insensitive on the heading text. Returns null if the section is absent.
 */
function extractSection(lines: string[], heading: string): string | null {
  const target = heading.trim().toLowerCase();
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const match = /^##\s+(.+?)\s*$/.exec(lines[i]);
    if (match && match[1].trim().toLowerCase() === target) {
      start = i + 1;
      break;
    }
  }

  if (start === -1) {
    return null;
  }

  const body: string[] = [];
  for (let i = start; i < lines.length; i++) {
    // Stop at the next level-2 heading (a new section). Deeper `### ` headings
    // belong to this section and are kept.
    if (/^##\s+/.test(lines[i]) && !/^###/.test(lines[i])) {
      break;
    }
    body.push(lines[i]);
  }

  return body.join("\n").trim();
}

/**
 * Parse a generated project breakdown into its denormalized columns.
 *
 * @param markdown       The full generated markdown.
 * @param fallbackName   Name to use when the markdown has no H1 (typically the
 *                       user's input). Defaults to "Untitled project".
 */
export function parseProjectBreakdown(
  markdown: string,
  fallbackName = "Untitled project"
): ParsedProjectBreakdown {
  const source = typeof markdown === "string" ? markdown : "";
  const lines = source.split(/\r?\n/);

  const rawName =
    extractH1(lines) || fallbackName.trim() || "Untitled project";
  const name = clampName(rawName);
  const purpose = extractSection(lines, "Purpose") ?? "";
  const successful_outcome = extractSection(lines, "Successful Outcome") ?? "";

  return { name, purpose, successful_outcome };
}
