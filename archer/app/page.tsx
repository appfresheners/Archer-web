"use client";

import ActionBar from "@/components/ActionBar";
import InputSection from "@/components/InputSection";
import ModeToggle from "@/components/ModeToggle";
import OutputPanel from "@/components/OutputPanel";
import { generateGoalTemplate } from "@/lib/templates/goal-template";
import { generateProjectTemplate } from "@/lib/templates/project-template";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"goal" | "project">("goal");
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  const handleModeChange = (newMode: "goal" | "project") => {
    setMode(newMode);
    setInputText("");
    setOutput("");
  };

  const handleSubmit = () => {
    if (mode === "goal") {
      setOutput(generateGoalTemplate(inputText));
    } else {
      setOutput(generateProjectTemplate(inputText));
    }
  };

  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.focus();

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      outputRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  }, [output]);

  return (
    <main className="mx-auto max-w-[640px] px-[var(--spacing-page-x)] lg:px-[var(--spacing-page-x-lg)] py-[var(--spacing-section-y)]">
      <h1 className="text-[length:var(--font-size-hero)] font-bold text-text-primary">
        Archer
      </h1>
      <p className="mt-2 text-text-secondary">
        Type a goal. Get the next actions.
      </p>

      <div className="mt-[var(--spacing-section-y)] flex justify-center">
        <ModeToggle mode={mode} onModeChange={handleModeChange} />
      </div>

      <div className="mt-[var(--spacing-section-y)]">
        <InputSection
          key={mode}
          mode={mode}
          inputText={inputText}
          onInputChange={setInputText}
          onSubmit={handleSubmit}
        />
      </div>

      {output && (
        <div className="mt-[var(--spacing-section-y)]">
          <OutputPanel ref={outputRef} markdown={output} />
        </div>
      )}

      {output && (
        <div className="mt-4">
          <ActionBar markdown={output} />
        </div>
      )}
    </main>
  );
}
