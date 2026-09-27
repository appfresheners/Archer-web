import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Weekly Review — Archer",
};

/** Placeholder Weekly Review page — real content arrives in a later epic. */
export default function ReviewPage() {
  return (
    <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
      Weekly Review
    </h1>
  );
}
