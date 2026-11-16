"use client";

import type { CollectionStatus } from "@prisma/client";
import { format } from "@/lib/i18n/config";
import { useI18n } from "./i18n";

// How a household sees one collection's points. Only VERIFIED collections count toward the balance:
// FLAGGED ones are held while an admin reviews them, REJECTED ones were reviewed and not counted.

export function CollectionPoints({ status, score, size = "md" }: { status: CollectionStatus; score: number; size?: "md" | "lg" }) {
  const { t } = useI18n();
  if (status === "VERIFIED") {
    return (
      <span className={`${size === "lg" ? "text-xl" : "text-lg"} font-extrabold tabular-nums text-forest`}>
        +{score} {t.common.pts}
      </span>
    );
  }
  return (
    <span className="text-sm font-semibold tabular-nums text-slate-green">
      {status === "FLAGGED" ? format(t.status.onHold, { n: score }) : t.status.notCounted}
    </span>
  );
}

export function CollectionStatusNote({ status }: { status: CollectionStatus }) {
  const { t } = useI18n();
  if (status === "VERIFIED") return null;
  return <p className="text-sm font-semibold text-danger">{status === "FLAGGED" ? t.status.flaggedNote : t.status.rejectedNote}</p>;
}

export function CollectionStatusLabel({ status }: { status: CollectionStatus }) {
  const { t } = useI18n();
  const label = status === "VERIFIED" ? t.status.verified : status === "FLAGGED" ? t.status.underReview : t.status.notCounted;
  return status === "VERIFIED" ? <>{label}</> : <span className="font-semibold text-danger">{label}</span>;
}

/** English label for admin screens (not translated). */
export const collectionStatusLabel = (status: CollectionStatus) =>
  status === "VERIFIED" ? "Verified" : status === "FLAGGED" ? "Under review" : "Not counted";
