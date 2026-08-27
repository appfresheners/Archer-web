"use client";

import { forwardRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface OutputPanelProps {
    markdown: string;
}

const OutputPanel = forwardRef<HTMLDivElement, OutputPanelProps>(
    ({ markdown }, ref) => {
        return (
            <div
                ref={ref}
                role="region"
                aria-label="Generated GTD template"
                tabIndex={-1}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 motion-safe:animate-fade-in focus:outline-none"
            >
                <div className="output-prose">
                    <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
                </div>
            </div>
        );
    }
);

OutputPanel.displayName = "OutputPanel";
export default OutputPanel;
