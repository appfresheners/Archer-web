"use client";

import { useId, useState } from "react";

interface InputSectionProps {
    mode: "goal" | "project";
    inputText: string;
    onInputChange: (text: string) => void;
    onSubmit: () => void;
}

const placeholders: Record<"goal" | "project", string> = {
    goal: "e.g., Become a proficient guitarist in 3 months",
    project: "e.g., Personal portfolio website deployed online",
};

export default function InputSection({
    mode,
    inputText,
    onInputChange,
    onSubmit,
}: InputSectionProps) {
    const [validationError, setValidationError] = useState("");
    const errorId = useId();
    const inputId = useId();

    const isEmpty = inputText.trim() === "";

    const handleAttemptSubmit = () => {
        if (isEmpty) {
            setValidationError("Enter a goal or project first");
            return;
        }
        onSubmit();
    };

    const handleInputChange = (value: string) => {
        if (validationError) {
            setValidationError("");
        }
        onInputChange(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            handleAttemptSubmit();
        }
    };

    return (
        <div>
            <label htmlFor={inputId} className="sr-only">
                Enter your {mode}
            </label>
            <input
                id={inputId}
                type="text"
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholders[mode]}
                maxLength={500}
                aria-describedby={validationError ? errorId : undefined}
                className="w-full rounded-[var(--radius-sm)] border border-border bg-background py-3 px-4 text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:outline-none min-h-[44px]"
            />
            {validationError && (
                <p id={errorId} role="alert" className="text-sm text-[var(--color-error,#b91c1c)] mt-1">
                    {validationError}
                </p>
            )}
            <button
                type="button"
                onClick={handleAttemptSubmit}
                aria-disabled={isEmpty ? "true" : undefined}
                className={`w-full min-h-[44px] rounded-[var(--radius-sm)] font-bold py-3 px-6 mt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${isEmpty
                    ? "bg-primary/40 text-white/60 cursor-not-allowed pointer-events-none"
                    : "bg-primary text-white hover:bg-primary-hover motion-safe:transition-colors motion-safe:duration-150"
                    }`}
            >
                Generate
            </button>
        </div>
    );
}
