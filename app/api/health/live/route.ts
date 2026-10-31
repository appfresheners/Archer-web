import { checkProcess } from "@/lib/observability/health";
import { withHttpMetrics } from "@/lib/observability/http";

export const runtime = "nodejs";

export const GET = withHttpMetrics(
  {
    method: "GET",
    route: "/api/health/live",
    expectedStatusCodes: [200],
  },
  async () => {
    const processCheck = checkProcess();
    const alive = processCheck.status === "available";

    return Response.json(
      {
        status: alive ? "healthy" : "unhealthy",
        checks: { process: processCheck },
      },
      { status: alive ? 200 : 503 },
    );
  },
);