/**
 * Slugify utility — converts arbitrary text into a URL/filename-safe slug.
 * Pure function, no side effects.
 */
export function slugify(text: string, maxLength: number = 50): string {
    // Trim whitespace and handle empty/whitespace-only input
    const trimmed = text.trim();
    if (!trimmed) {
        return "untitled";
    }

    // Lowercase, replace non-alphanumeric characters (except hyphens and spaces) with empty string
    let slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/[\s]+/g, "-") // collapse whitespace into single hyphens
        .replace(/-+/g, "-") // collapse consecutive hyphens
        .replace(/^-+/, "") // trim leading hyphens
        .replace(/-+$/, ""); // trim trailing hyphens

    // Handle case where all characters were stripped
    if (!slug) {
        return "untitled";
    }

    // Truncate at word boundary if exceeding maxLength
    if (slug.length > maxLength) {
        slug = slug.slice(0, maxLength);

        // Find the last hyphen to truncate at word boundary
        const lastHyphen = slug.lastIndexOf("-");
        if (lastHyphen > 0) {
            slug = slug.slice(0, lastHyphen);
        }

        // Remove any trailing hyphens after truncation
        slug = slug.replace(/-+$/, "");

        // If truncation emptied the slug, fall back
        if (!slug) {
            return "untitled";
        }
    }

    return slug;
}
