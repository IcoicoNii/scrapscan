// THE scoring rule. Proposed mapping (confirm with the barangay):
//   0 contaminated bins -> 10, 1 -> 5, 2 or 3 -> 0.
// Only the server calls this. Clients display the result, never compute it.
export type BinResult = "CORRECT" | "CONTAMINATED";

export type Bins = {
  biodegradable: BinResult;
  recyclable: BinResult;
  residual: BinResult;
};

export type Score = 0 | 5 | 10;

export function scoreCollection(bins: Bins): Score {
  const contaminated = Object.values(bins).filter((r) => r === "CONTAMINATED").length;
  if (contaminated === 0) return 10;
  if (contaminated === 1) return 5;
  return 0;
}
