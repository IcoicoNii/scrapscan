import { authorize, jsonResponse } from "@/lib/api";
import { collectorDirectory } from "@/lib/directory";

// GET /api/collector/directory: the minimal household list a collector's phone keeps for offline
// scanning (see src/lib/directory.ts for exactly what's in it). Never cached by browsers or proxies.
export async function GET() {
  const user = await authorize("household:lookup");
  if (user instanceof Response) return user;
  return jsonResponse({ ok: true, ...(await collectorDirectory()) }, 200);
}
