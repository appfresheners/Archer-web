import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/schema";

const SUPABASE_CHECK_TIMEOUT_MS = 2_000;

export type HealthState = "available" | "unavailable";

export interface HealthCheckResult {
  status: HealthState;
}

export function checkProcess(): HealthCheckResult {
  return {
    status:
      Number.isFinite(process.uptime()) && process.uptime() > 0
        ? "available"
        : "unavailable",
  };
}

export async function checkSupabase(): Promise<HealthCheckResult> {
  try {
    const supabase = createSupabaseClient<Database>(
      getSupabaseUrl(),
      getServiceRoleKey(),
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) =>
            fetch(input, { ...init, cache: "no-store", redirect: "error" }),
        },
      },
    );
    const { error } = await supabase
      .from("goals")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(SUPABASE_CHECK_TIMEOUT_MS));

    return { status: error ? "unavailable" : "available" };
  } catch {
    return { status: "unavailable" };
  }
}