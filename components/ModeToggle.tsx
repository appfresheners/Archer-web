import { useRef, useState } from "react";

interface ModeToggleProps {
    mode: "goal" | "project";
    onModeChange: (mode: "goal" | "project") => void;
}

export default function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
    const [hasInteracted, setHasInteracted] = useState(false);
    const goalRef = useRef<HTMLDivElement>(null);
    const projectRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent, tabMode: "goal" | "project") => {
        const otherMode = tabMode === "goal" ? "project" : "goal";

        switch (e.key) {
            case "ArrowLeft":
            case "ArrowRight":
                e.preventDefault();
                setHasInteracted(true);
                onModeChange(otherMode);
                // Move focus to the newly active tab
                if (otherMode === "goal") {
                    goalRef.current?.focus();
                } else {
                    projectRef.current?.focus();
                }
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                setHasInteracted(true);
                onModeChange(tabMode);
                break;
        }
    };

    const handleClick = (clickedMode: "goal" | "project") => {
        setHasInteracted(true);
        onModeChange(clickedMode);
    };

    const announcement = hasInteracted
        ? (mode === "goal" ? "Goal mode selected" : "Project mode selected")
        : "";

    return (
        <div
            role="tablist"
            aria-label="Template mode"
            className="inline-flex rounded-full bg-surface border border-border p-1"
        >
            <div role="status" aria-live="polite" className="sr-only">
                {announcement}
            </div>
            <div
                ref={goalRef}
                role="tab"
                aria-selected={mode === "goal"}
                tabIndex={mode === "goal" ? 0 : -1}
                onClick={() => handleClick("goal")}
                onKeyDown={(e) => handleKeyDown(e, "goal")}
                className={`min-h-[44px] px-6 py-3 flex items-center justify-center rounded-full cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${mode === "goal"
                    ? "bg-primary text-white font-bold"
                    : "bg-transparent text-text-secondary font-normal"
                    }`}
            >
                Goal
            </div>
            <div
                ref={projectRef}
                role="tab"
                aria-selected={mode === "project"}
                tabIndex={mode === "project" ? 0 : -1}
                onClick={() => handleClick("project")}
                onKeyDown={(e) => handleKeyDown(e, "project")}
                className={`min-h-[44px] px-6 py-3 flex items-center justify-center rounded-full cursor-pointer select-none motion-safe:transition-colors motion-safe:duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${mode === "project"
                    ? "bg-primary text-white font-bold"
                    : "bg-transparent text-text-secondary font-normal"
                    }`}
            >
                Project
            </div>
        </div>
    );
}
