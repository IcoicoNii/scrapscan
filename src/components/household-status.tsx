"use client";

import type { HouseholdStatus } from "@prisma/client";
import { format } from "@/lib/i18n/config";
import { useI18n } from "./i18n";
import { Notice } from "./ui";

// What a resident sees about their household's status. Nothing while it's active.
export function HouseholdStatusNotice({ status, statusNote }: { status: HouseholdStatus; statusNote: string | null }) {
  const { t } = useI18n();
  if (status === "ACTIVE") return null;
  if (status === "PENDING") {
    return (
      <Notice>
        <strong className="font-bold">{t.status.pendingTitle}</strong> {t.status.pendingBody}
      </Notice>
    );
  }
  return (
    <Notice tone="warn">
      {statusNote ? (
        <>
          <strong className="font-bold">{t.status.declinedTitle}</strong> {format(t.status.declinedNote, { note: statusNote })}
        </>
      ) : (
        <>
          <strong className="font-bold">{t.status.offTitle}</strong> {t.status.offBody}
        </>
      )}
    </Notice>
  );
}
