/**
 * Escapes characters that could break markdown structure when user input is interpolated.
 * Shared utility used by all template generators.
 */
export function escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!|~>]/g, "\\$&");
}
