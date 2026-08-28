/**
 * Escapes characters that could break markdown structure when user input is interpolated.
 */
function escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!|~>]/g, "\\$&");
}

/**
 * Generates a GTD Project Mode markdown template with the user's project inserted.
 * Pure function: no side effects, deterministic, synchronous.
 */
export function generateProjectTemplate(input: string): string {
    const safeInput = escapeMarkdown(input);
    return `# ${safeInput}

## Purpose

[Why this project matters — what will completing it enable or change?]

## Successful Outcome

[Describe exactly what "done" looks like in observable, real-world terms. Someone watching should be able to confirm it's complete.]

## Next Actions

- [ ] Open [specific app/tool/browser]
- [ ] Navigate to [specific location or URL]
- [ ] Click [specific button or menu item]
- [ ] Type "[specific text to enter]"
- [ ] Create [specific artifact — file, page, document]
- [ ] Save [with specific name and location]
- [ ] Search "[specific search term]"
- [ ] Read [specific small section or result]
- [ ] Write down [specific small deliverable]
- [ ] Complete [specific tiny verification step]
`;
}
