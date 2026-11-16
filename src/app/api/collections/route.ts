import { authorizeJson, jsonResponse } from "@/lib/api";
import { recordCollection, type RecordErrorCode } from "@/lib/collections";

// POST /api/collections: record one collection from the collector's device (live or from the offline queue).
//
// Retry rule for the client: 2xx = done; 401 = sign in again, then retry; any other 4xx = final, show
// the message and drop it from the queue; 5xx or network error = keep it queued and retry with the SAME id.
const STATUS: Record<RecordErrorCode, number> = {
  INVALID: 400,
  OUT_OF_RANGE: 422,
  HOUSEHOLD_NOT_FOUND: 404,
  QR_REVOKED: 422,
  HOUSEHOLD_INACTIVE: 422,
  HOUSEHOLD_PENDING: 422,
  ALREADY_COLLECTED: 409,
  ID_CONFLICT: 409,
};

export async function POST(request: Request) {
  const auth = await authorizeJson(request, "collection:create");
  if (auth instanceof Response) return auth;

  const result = await recordCollection(auth.user.id, auth.body);
  return jsonResponse(result, result.ok ? (result.replay ? 200 : 201) : STATUS[result.error]);
}
