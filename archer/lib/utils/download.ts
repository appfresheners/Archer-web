/**
 * Download utility — triggers a browser-native file download.
 * Components should call this instead of constructing Blobs or object URLs directly.
 */
export function downloadMarkdown(
    content: string,
    filename: string
): { success: boolean } {
    try {
        if (typeof URL.createObjectURL !== "function") {
            return { success: false };
        }

        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = "none";

        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        // Delay revocation slightly — Firefox may not complete the download
        // if the object URL is revoked synchronously after click.
        setTimeout(() => URL.revokeObjectURL(url), 100);

        return { success: true };
    } catch {
        return { success: false };
    }
}

/**
 * Sibling of `downloadMarkdown` that mirrors the exact Blob→object-URL→anchor
 * →revoke flow but writes an `application/json` file. Used to export the
 * encrypted vault envelope as a single downloadable file (client-side only,
 * no network). Kept as a thin sibling so the download flow stays identical
 * rather than diverging.
 */
export function downloadJson(
    content: string,
    filename: string
): { success: boolean } {
    try {
        if (typeof URL.createObjectURL !== "function") {
            return { success: false };
        }

        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = "none";

        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        // Delay revocation slightly — Firefox may not complete the download
        // if the object URL is revoked synchronously after click.
        setTimeout(() => URL.revokeObjectURL(url), 100);

        return { success: true };
    } catch {
        return { success: false };
    }
}
