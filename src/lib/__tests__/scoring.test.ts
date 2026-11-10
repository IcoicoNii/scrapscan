import { describe, expect, it } from "vitest";
import { scoreCollection, type BinResult } from "../scoring";

const C: BinResult = "CORRECT";
const X: BinResult = "CONTAMINATED";

describe("scoreCollection (10/5/0)", () => {
  it("awards 10 when nothing is contaminated", () => {
    expect(scoreCollection({ biodegradable: C, recyclable: C, residual: C })).toBe(10);
  });
  it("awards 5 for exactly one contaminated bin, whichever it is", () => {
    expect(scoreCollection({ biodegradable: X, recyclable: C, residual: C })).toBe(5);
    expect(scoreCollection({ biodegradable: C, recyclable: X, residual: C })).toBe(5);
    expect(scoreCollection({ biodegradable: C, recyclable: C, residual: X })).toBe(5);
  });
  it("awards 0 for two or three contaminated bins", () => {
    expect(scoreCollection({ biodegradable: X, recyclable: X, residual: C })).toBe(0);
    expect(scoreCollection({ biodegradable: X, recyclable: X, residual: X })).toBe(0);
  });
});
