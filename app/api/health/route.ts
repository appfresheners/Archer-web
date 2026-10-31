import { checkProcess, checkSupabase } from "@/lib/observability/health";
import { withHttpMetrics } from "@/lib/observability/http";

export const runtime = "nodejs";

export const GET = withHttpMetrics(
  {
    method: "GET",
    route: "/api/health",
    expectedStatusCodes: [200, 503],
  },
  async () => {
    const processCheck = checkProcess();
    const databaseCheck = await checkSupabase();
    const healthy =
      processCheck.status === "available" &&
      databaseCheck.status === "available";

    return Response.json(
      {
        status: healthy ? "healthy" : "unhealthy",
        checks: { process: processCheck, supabase: databaseCheck },
      },
      { status: healthy ? 200 : 503 },
    );
  },
);