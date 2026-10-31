import { checkSupabase } from "@/lib/observability/health";
import { withHttpMetrics } from "@/lib/observability/http";

export const runtime = "nodejs";

export const GET = withHttpMetrics(
  {
    method: "GET",
    route: "/api/health/ready",
    expectedStatusCodes: [200, 503],
  },
  async () => {
    const databaseCheck = await checkSupabase();
    const ready = databaseCheck.status === "available";

    return Response.json(
      {
        status: ready ? "ready" : "not_ready",
        checks: { supabase: databaseCheck },
      },
      { status: ready ? 200 : 503 },
    );
  },
);