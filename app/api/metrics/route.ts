import { metricsRegistry } from "@/lib/observability/http";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return new Response(await metricsRegistry.metrics(), {
    headers: {
      "Content-Type": metricsRegistry.contentType,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}