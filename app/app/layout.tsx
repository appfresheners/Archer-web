/**
 * Authenticated app-shell layout (server component).
 *
 * Every `/app/*` route inherits this shell. It performs a defense-in-depth
 * auth check: middleware already guards `/app/*`, but this layout must not
 * render for an unauthenticated user, so it reads the session via the server
 * Supabase client and redirects to `/sign-in` when there is no user.
 *
 * Composition:
 *   - `Sidebar`        — desktop/tablet navigation (hidden `<768px`).
 *   - `BottomNav`      — mobile navigation (shown only `<768px`).
 *   - `FloatingCapture`— persistent capture affordance (button + `C` shortcut).
 *   - `{children}`     — the route's page, in a main region capped at 720px.
 *
 * Responsiveness is entirely CSS/Tailwind breakpoint-driven in the child
 * components; this layout only lays out the flex row and caps the content.
 */

import BottomNav from "@/components/authenticated/BottomNav";
import FloatingCapture from "@/components/authenticated/FloatingCapture";
import MonthlyGoalCheckPrompt, {
  type MonthlyGoalCheckPromptGoal,
} from "@/components/authenticated/MonthlyGoalCheckPrompt";
import Sidebar from "@/components/authenticated/Sidebar";
import { getMonthlyGoalCheckCutoff } from "@/lib/goals/monthlyCheck";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: the shell never renders for an unauthenticated user.
  // On any auth failure — no user OR a transient error reaching Supabase —
  // redirect to /sign-in rather than 500-ing the whole /app subtree. The
  // Supabase call is isolated in its own try/catch so it never swallows the
  // NEXT_REDIRECT control-flow signal that `redirect()` throws.
  let user = null;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  if (!user || !supabase) {
    redirect("/sign-in");
  }

  let dueGoals: MonthlyGoalCheckPromptGoal[] = [];
  try {
    const cutoff = getMonthlyGoalCheckCutoff();
    const { data, error } = await supabase
      .from("goals")
      .select("id, goal_text")
      .eq("user_id", user.id)
      .eq("status", "active")
      .or(
        `last_checked_at.lte.${cutoff},and(last_checked_at.is.null,created_at.lte.${cutoff})`,
      );
    if (!error) dueGoals = (data ?? []) as MonthlyGoalCheckPromptGoal[];
  } catch {
    dueGoals = [];
  }

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <Sidebar />

      {/* Main content: centred, capped at 720px. Bottom padding on mobile
          keeps content clear of the fixed bottom nav bar. */}
      <main className="flex-1 overflow-x-hidden px-[var(--spacing-page-x)] pb-24 pt-[var(--spacing-section-y)] md:px-[var(--spacing-page-x-lg)] md:pb-[var(--spacing-section-y)]">
        <div className="mx-auto w-full max-w-[var(--spacing-content-max)]">
          <MonthlyGoalCheckPrompt goals={dueGoals} />
          {children}
        </div>
      </main>

      <BottomNav />
      <FloatingCapture />
    </div>
  );
}
