import { getServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

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
    const response = await fetch(
      new URL("/auth/v1/health", getSupabaseUrl()),
      {
        headers: { apikey: getServiceRoleKey() },
        signal: AbortSignal.timeout(SUPABASE_CHECK_TIMEOUT_MS),
        cache: "no-store",
      },
    );

    return { status: response.ok ? "available" : "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}