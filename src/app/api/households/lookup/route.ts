import { authorizeJson, jsonResponse } from "@/lib/api";
import { lookupHousehold, type HouseholdLookup } from "@/lib/collections";
import { getI18n } from "@/lib/i18n/server";

// POST /api/households/lookup  { qrToken } | { code }
// Lets a collector confirm which household they're at before checking the bins.
// POST rather than GET so QR tokens stay out of URLs and access logs.
const STATUS: Record<Extract<HouseholdLookup, { ok: false }>["error"], number> = {
  INVALID: 400,
  HOUSEHOLD_NOT_FOUND: 404,
  QR_REVOKED: 422,
  HOUSEHOLD_INACTIVE: 422,
  HOUSEHOLD_PENDING: 422,
};

export async function POST(request: Request) {
  const auth = await authorizeJson(request, "household:lookup");
  if (auth instanceof Response) return auth;

  const { t } = await getI18n(); // messages in the collector's language
  const result = await lookupHousehold(auth.body, new Date(), t.errors.collection);
  return jsonResponse(result, result.ok ? 200 : STATUS[result.error]);
}
