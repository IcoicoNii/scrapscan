import type { CollectionStatus } from "@prisma/client";

// How a household sees one collection's points. Only VERIFIED collections count toward the balance:
// FLAGGED ones are held while an admin reviews them, REJECTED ones were reviewed and not counted.

export function CollectionPoints({ status, score, size = "md" }: { status: CollectionStatus; score: number; size?: "md" | "lg" }) {
  if (status === "VERIFIED") {
    return (
      <span className={`${size === "lg" ? "text-xl" : "text-lg"} font-extrabold tabular-nums text-forest`}>+{score} pts</span>
    );
  }
  return (
    <span className="text-sm font-semibold tabular-nums text-slate-green">
      {status === "FLAGGED" ? `${score} pts on hold` : "Not counted"}
    </span>
  );
}

export function CollectionStatusNote({ status }: { status: CollectionStatus }) {
  if (status === "VERIFIED") return null;
  return (
    <p className="text-sm font-semibold text-danger">
      {status === "FLAGGED"
        ? "Under review by your barangay admin. These points are on hold until it’s checked."
        : "Your barangay admin reviewed this collection and didn’t count its points. Ask them if you have questions."}
    </p>
  );
}

export const collectionStatusLabel = (status: CollectionStatus) =>
  status === "VERIFIED" ? "Verified" : status === "FLAGGED" ? "Under review" : "Not counted";
