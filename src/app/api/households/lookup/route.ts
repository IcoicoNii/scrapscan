import { authorizeJson, jsonResponse } from "@/lib/api";
import { lookupHousehold, type HouseholdLookup } from "@/lib/collections";

// POST /api/households/lookup  { qrToken } | { code }
// Lets a collector confirm which household they're at before checking the bins.
// POST rather than GET so QR tokens stay out of URLs and access logs.
const STATUS: Record<Extract<HouseholdLookup, { ok: false }>["error"], number> = {
  INVALID: 400,
  HOUSEHOLD_NOT_FOUND: 404,
  QR_REVOKED: 422,
  HOUSEHOLD_INACTIVE: 422,
};

export async function POST(request: Request) {
  const auth = await authorizeJson(request, "household:lookup");
  if (auth instanceof Response) return auth;

  const result = await lookupHousehold(auth.body);
  return jsonResponse(result, result.ok ? 200 : STATUS[result.error]);
}
