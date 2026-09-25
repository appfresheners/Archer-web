"use client";

import { forwardRef } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
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
                className="motion-safe:animate-fade-in focus:outline-none"
            >
                <div className="output-prose">
                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{markdown}</Markdown>
                </div>
            </div>
        );
    }
);

OutputPanel.displayName = "OutputPanel";
export default OutputPanel;
