import type { CollectionStatus } from "@prisma/client";

// Plain (non-client) helper so server components can call it. The translated resident-facing
// version is the <CollectionStatusLabel> component in components/collection-status.tsx.

/** English label for admin screens (not translated). */
export const collectionStatusLabel = (status: CollectionStatus) =>
  status === "VERIFIED" ? "Verified" : status === "FLAGGED" ? "Under review" : "Not counted";
