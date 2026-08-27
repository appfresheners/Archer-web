/**
 * Clipboard utility — wraps the native Clipboard API.
 * Components should call this instead of navigator.clipboard directly.
 */
export async function copyToClipboard(
    text: string
): Promise<{ success: boolean }> {
    try {
        if (!navigator?.clipboard?.writeText) {
            return { success: false };
        }
        await navigator.clipboard.writeText(text);
        return { success: true };
    } catch {
        return { success: false };
    }
}
