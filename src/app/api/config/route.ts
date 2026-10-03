import { getDemoConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getDemoConfig(), { headers: { "Cache-Control": "no-store" } });
}
