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
