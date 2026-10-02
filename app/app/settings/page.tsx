import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings — Archer",
};

/** Placeholder Settings page — real content arrives in a later epic. */
export default function SettingsPage() {
  return (
    <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
      Settings
    </h1>
  );
}
