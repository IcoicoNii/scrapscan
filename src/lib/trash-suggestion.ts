// Pure module (no server-only imports): the shape of an AI bin suggestion and the parser for the model's reply.
// The collector picks which category the bag should be (biodegradable, recyclable or residual). The AI
// checks the bag against that category. The collector confirms every bin, and the server still decides the score.
import { z } from "zod";

export const TRASH_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const TRASH_CATEGORIES = ["biodegradable", "recyclable", "residual"] as const;
export type TrashCategory = (typeof TRASH_CATEGORIES)[number];

// The phone downsizes photos before sending, so this only guards against oversized requests.
export const MAX_TRASH_IMAGE_BASE64 = 5_600_000; // about 4 MB of image data

export type BinResult = "CORRECT" | "CONTAMINATED";

/** One scan judges one category. The other categories are not part of the result. */
export type TrashSuggestion = {
  category: TrashCategory;
  result: BinResult;
  notes: string;
};

export const trashImageSchema = z.strictObject({
  mediaType: z.enum(TRASH_IMAGE_TYPES),
  // The category the collector chose for this bag.
  expected: z.enum(TRASH_CATEGORIES),
  data: z
    .string()
    .min(1)
    .max(MAX_TRASH_IMAGE_BASE64)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "base64 only"),
});
export type TrashImage = z.infer<typeof trashImageSchema>;

const replySchema = z.object({
  // Accept true/false as a boolean or as the text "true"/"false".
  matches: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() === "true" : v), z.boolean()),
  notes: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().trim().max(300)),
});

/**
 * The result for the one category this scan checked. The collector's other categories are not
 * touched: the client only changes the category returned here.
 */
export function suggestionFor(expected: TrashCategory, matches: boolean, notes: string): TrashSuggestion {
  return { category: expected, result: matches ? "CORRECT" : "CONTAMINATED", notes };
}

/**
 * Reads the model's reply. The reply may wrap the JSON in a code fence or add a sentence, so take the
 * first {...} block. Returns "UNCLEAR" when the model can't see the bag's contents, and null when the
 * reply isn't usable.
 */
export function parseTrashReply(text: string, expected: TrashCategory): TrashSuggestion | "UNCLEAR" | null {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (raw && typeof raw === "object" && (raw as { unclear?: unknown }).unclear === true) return "UNCLEAR";
  const parsed = replySchema.safeParse(raw);
  return parsed.success ? suggestionFor(expected, parsed.data.matches, parsed.data.notes) : null;
}
