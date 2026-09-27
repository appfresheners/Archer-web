import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Goals — Archer",
};

/** Placeholder Goals page — real content arrives in a later epic. */
export default function GoalsPage() {
  return (
    <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
      Goals
    </h1>
  );
}
