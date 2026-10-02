/**
 * Shared error types for the AI generation layer.
 */

/**
 * Thrown when the model returns a response that cannot be parsed into the
 * expected structured shape. The message is a developer-facing diagnostic;
 * routes map this single type to one friendly user message.
 */
export class GenerationFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "GenerationFormatError";
    }
}
