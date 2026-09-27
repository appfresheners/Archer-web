import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inbox — Archer",
};

/** Placeholder Inbox page — real content arrives in a later epic. */
export default function InboxPage() {
  return (
    <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
      Inbox
    </h1>
  );
}
