import "server-only";
import { parseTrashReply, type TrashCategory, type TrashImage, type TrashSuggestion } from "./trash-suggestion";

// Sends one photo of sorted waste to Google Gemini (vision) and returns a bin suggestion.
// Configuration: GEMINI_API_KEY (required), GEMINI_MODEL (optional, defaults to gemini-3.1-flash-lite,
// the model that answered reliably in testing; gemini-3.8-flash was overloaded).
// The photo is sent to Google and not stored here. Errors are logged without the image or the reply.

export type AnalyzeError = "NOT_CONFIGURED" | "UNCLEAR" | "AI_FAILED";
export type AnalyzeResult = { ok: true; suggestion: TrashSuggestion } | { ok: false; error: AnalyzeError };

const CATEGORY_RULES = `Categories:
- biodegradable: food scraps, leaves, garden waste only.
- recyclable: clean, dry paper, cardboard, plastic bottles and containers, glass bottles, metal cans.
- residual (not biodegradable, not recyclable): everything else, such as diapers, sachets, chip wrappers, greasy or dirty items, broken ceramics.`;

const promptFor = (expected: TrashCategory) => `This photo shows one bag or bin of household waste from a barangay collection.
The collector says this bag should contain ONLY ${expected} waste.

${CATEGORY_RULES}

Look at every item you can see in the bag. The bag matches only if every visible item is ${expected}.
If you cannot see the contents clearly, answer {"unclear": true}.
Otherwise answer with JSON only, no other text:
{"matches": true or false, "notes": "one short sentence: what you see, and if it does not match, name the item that does not belong"}`;

export async function analyzeTrashPhoto(image: TrashImage): Promise<AnalyzeResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { ok: false, error: "NOT_CONFIGURED" };
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body = JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: image.mediaType, data: image.data } }, { text: promptFor(image.expected) }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    });
    // Gemini answers 503 / 429 when it's busy. Try at most twice, with a short wait before the retry.
    // A reply can take 30-50 seconds, so each attempt gets 45 seconds.
    let res: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
      res = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      });
      if (res.ok || (res.status !== 503 && res.status !== 429)) break;
      console.error("[trash-ai] Gemini busy (status", res.status, "), attempt", attempt + 1);
    }
    if (!res?.ok) {
      console.error("[trash-ai] Gemini responded with status", res?.status);
      return { ok: false, error: "AI_FAILED" };
    }
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text ?? "";
    const parsed = parseTrashReply(text, image.expected);
    if (parsed === "UNCLEAR") return { ok: false, error: "UNCLEAR" };
    if (!parsed) {
      // Log only the start of the reply (model output, never the photo), to see what went wrong.
      console.error("[trash-ai] reply was not in the expected format:", text.slice(0, 200));
      return { ok: false, error: "AI_FAILED" };
    }
    return { ok: true, suggestion: parsed };
  } catch (e) {
    console.error("[trash-ai] request failed:", e instanceof Error ? e.name : "unknown error");
    return { ok: false, error: "AI_FAILED" };
  }
}
