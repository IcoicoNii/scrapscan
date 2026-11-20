import { authorize, jsonResponse } from "@/lib/api";
import { analyzeTrashPhoto, type AnalyzeError } from "@/lib/trash-ai";
import { trashImageSchema } from "@/lib/trash-suggestion";

// POST /api/trash/analyze: a collector sends one photo of the sorted bins, gets a suggested
// CORRECT / CONTAMINATED per bin. Nothing is saved here; the collector confirms and saves as usual.
const STATUS: Record<AnalyzeError, number> = {
  NOT_CONFIGURED: 503,
  UNCLEAR: 422,
  AI_FAILED: 502,
};

export async function POST(request: Request) {
  const user = await authorize("trash:analyze");
  if (user instanceof Response) return user;

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, 415);
  }
  const body = await request.json().catch(() => null);
  const image = trashImageSchema.safeParse(body);
  if (!image.success) return jsonResponse({ ok: false, error: "INVALID" }, 400);

  const result = await analyzeTrashPhoto(image.data);
  if (result.ok) return jsonResponse({ ok: true, suggestion: result.suggestion }, 200);
  return jsonResponse({ ok: false, error: result.error }, STATUS[result.error]);
}
