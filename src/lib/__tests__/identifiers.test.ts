import { describe, expect, it } from "vitest";
import { parseLoginId } from "../identifiers";
import { generateClaimCode, generateQrToken, normalizeClaimCode, QR_PREFIX } from "../codes";

describe("parseLoginId", () => {
  it("lowercases emails", () => {
    expect(parseLoginId("  Maria@Example.COM ")).toEqual({ kind: "email", value: "maria@example.com" });
  });
  it("normalizes Philippine mobile formats to +639XXXXXXXXX", () => {
    for (const v of ["09171234567", "+63 917 123 4567", "639171234567", "917-123-4567"]) {
      expect(parseLoginId(v)).toEqual({ kind: "phone", value: "+639171234567" });
    }
  });
  it("rejects junk", () => {
    expect(parseLoginId("hello")).toBeNull();
    expect(parseLoginId("0817123456")).toBeNull();
    expect(parseLoginId("a@b")).toBeNull();
  });
});

describe("codes", () => {
  it("claim codes are 8 chars from the unambiguous alphabet and survive normalization", () => {
    const c = generateClaimCode();
    expect(c).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    expect(normalizeClaimCode(`${c.slice(0, 4).toLowerCase()} - ${c.slice(4)}`)).toBe(c);
  });
  it("QR tokens are prefixed, unique and carry no readable data", () => {
    const a = generateQrToken();
    const b = generateQrToken();
    expect(a.startsWith(QR_PREFIX)).toBe(true);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });
});
