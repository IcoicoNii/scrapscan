"use client";

import { useEffect, useState } from "react";
import { BinChips } from "@/components/bin-chips";
import { Icon } from "@/components/icons";
import { EmptyState, Notice } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { dismiss, listItems, syncAll, type QueueItem } from "@/lib/offline/queue";
import { useSyncStatus } from "../sync-agent";
import { useI18n } from "@/components/i18n";
import { format, plural } from "@/lib/i18n/config";

export function QueueList({ collectorId }: { collectorId: string }) {
  const s = useSyncStatus();
  const { t } = useI18n();
  const c = t.collector;
  const [items, setItems] = useState<QueueItem[] | null>(null);

  // Reload whenever the counts change (an item sent, failed or was dismissed).
  useEffect(() => {
    let live = true;
    listItems(collectorId)
      .then(({ mine }) => live && setItems(mine))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [collectorId, s.pending, s.attention, s.lastSentAt]);

  if (!s.storage) {
    return <Notice tone="warn">{c.savedNoStorage}</Notice>;
  }
  if (items === null) return <div aria-busy="true" className="skeleton h-24" />;

  const pending = items.filter((i) => i.state === "pending");
  const attention = items.filter((i) => i.state === "attention");

  return (
    <div className="space-y-6">
      {s.signedOut && pending.length > 0 && (
        <Notice tone="warn">
          {c.savedSignedOut}{" "}
          <a href="/login" className="font-bold underline">{t.common.signIn}</a> {c.savedSignedOutAfter}
        </Notice>
      )}
      {s.otherAccounts > 0 && (
        <Notice>
          {plural(s.otherAccounts, c.otherAccountsOne, c.otherAccountsOther)}
        </Notice>
      )}

      {items.length === 0 ? (
        <EmptyState icon="check" title={c.nothingWaiting} body={c.nothingWaitingBody} />
      ) : null}

      {attention.length > 0 && (
        <section aria-labelledby="attention-h" className="space-y-3">
          <h2 id="attention-h" className="text-lg font-bold">{format(c.attentionTitle, { n: attention.length })}</h2>
          <p className="text-sm text-slate-green">{c.attentionIntro}</p>
          <ul className="space-y-3">
            {attention.map((i) => (
              <li key={i.id} className="card space-y-3">
                <ItemHeader item={i} />
                <p className="flex gap-2 text-sm font-semibold text-danger">
                  <Icon name="warn" className="mt-px h-5 w-5 shrink-0" />
                  {i.error?.message}
                </p>
                <button type="button" onClick={() => dismiss(i.id, collectorId)} className="btn btn-outline btn-sm">
                  {t.common.dismiss}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section aria-labelledby="pending-h" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="pending-h" className="text-lg font-bold">{format(c.pendingTitle, { n: pending.length })}</h2>
            {!s.signedOut && (
              <button
                type="button"
                disabled={s.syncing}
                onClick={() => syncAll(collectorId, { force: true })}
                className="btn btn-primary btn-sm"
              >
                {s.syncing ? t.common.sending : t.common.sendNow}
              </button>
            )}
          </div>
          <ul className="space-y-3">
            {pending.map((i) => (
              <li key={i.id} className="card space-y-3">
                <ItemHeader item={i} />
                <BinChips bins={i.payload.bins} />
                {i.attempts > 0 && (
                  <p className="text-sm text-slate-green">
                    {plural(i.attempts, c.triedOne, c.triedOther)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ItemHeader({ item }: { item: QueueItem }) {
  const { t, intl } = useI18n();
  const c = t.collector;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-bold">{item.household ? item.household.name : c.notConfirmed}</p>
        <p className="text-sm text-slate-green">
          {item.household?.code ??
            ("code" in item.payload.household ? format(c.typed, { code: item.payload.household.code }) : c.scannedQr)}
        </p>
      </div>
      <p className="shrink-0 text-right text-sm text-slate-green">{formatDateTime(new Date(item.payload.collectedAt), intl)}</p>
    </div>
  );
}
