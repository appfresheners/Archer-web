import type { Metadata } from "next";
import Breadcrumbs from "@/components/shared/Breadcrumbs";

export const metadata: Metadata = {
  title: "Settings — Archer",
};

/** Placeholder Settings page — real content arrives in a later epic. */
export default function SettingsPage() {
  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <Breadcrumbs items={[{ label: "Settings" }]} />
      <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
        Settings
      </h1>
    </section>
  );
}
