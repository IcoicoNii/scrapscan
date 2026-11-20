import { describe, expect, it } from "vitest";
import { parseTrashReply, suggestionFor, trashImageSchema } from "../trash-suggestion";

describe("suggestionFor", () => {
  it("returns CORRECT for the scanned category when the bag matches", () => {
    expect(suggestionFor("biodegradable", true, "Food scraps.")).toEqual({
      category: "biodegradable",
      result: "CORRECT",
      notes: "Food scraps.",
    });
  });

  it("returns CONTAMINATED for the scanned category when the bag doesn't match", () => {
    expect(suggestionFor("recyclable", false, "Diaper among bottles.")).toEqual({
      category: "recyclable",
      result: "CONTAMINATED",
      notes: "Diaper among bottles.",
    });
  });
});

describe("parseTrashReply", () => {
  it("reads a matching reply", () => {
    expect(parseTrashReply('{"matches": true, "notes": "Only bottles."}', "recyclable")).toEqual({
      category: "recyclable",
      result: "CORRECT",
      notes: "Only bottles.",
    });
  });

  it("reads a non-matching reply in a code fence, with matches as text", () => {
    const r = parseTrashReply('Here:\n```json\n{"matches": "false", "notes": "Diaper among bottles."}\n```', "recyclable");
    expect(r).toMatchObject({ category: "recyclable", result: "CONTAMINATED" });
  });

  it("reports an unclear photo", () => {
    expect(parseTrashReply('{"unclear": true}', "residual")).toBe("UNCLEAR");
  });

  it("rejects a reply without a yes/no answer, text with no JSON, and malformed JSON", () => {
    expect(parseTrashReply('{"notes": "hm"}', "residual")).toBeNull();
    expect(parseTrashReply("I cannot help with that.", "residual")).toBeNull();
    expect(parseTrashReply("{not json}", "residual")).toBeNull();
  });
});

describe("trashImageSchema", () => {
  it("accepts a jpeg base64 payload with a chosen category", () => {
    expect(trashImageSchema.safeParse({ mediaType: "image/jpeg", expected: "residual", data: "/9j/4AAQ==" }).success).toBe(true);
  });

  it("rejects a missing category, other media types, data URLs and non-base64 text", () => {
    expect(trashImageSchema.safeParse({ mediaType: "image/jpeg", data: "/9j/4AAQ==" }).success).toBe(false);
    expect(trashImageSchema.safeParse({ mediaType: "image/gif", expected: "residual", data: "R0lGOD==" }).success).toBe(false);
    expect(trashImageSchema.safeParse({ mediaType: "image/jpeg", expected: "residual", data: "data:image/jpeg;base64,/9j/" }).success).toBe(false);
    expect(trashImageSchema.safeParse({ mediaType: "image/jpeg", expected: "residual", data: "not base64!" }).success).toBe(false);
  });
});
