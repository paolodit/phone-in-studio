import { isAdminSession } from "@/lib/auth";
import { hostedSleepEnabled } from "@/lib/hosted-lifecycle";
export async function POST() {
  if (!hostedSleepEnabled()) return new Response(null, { status: 404 });
  return new Response(null, { status: await isAdminSession() ? 204 : 401, headers: { "Cache-Control": "no-store" } });
}
