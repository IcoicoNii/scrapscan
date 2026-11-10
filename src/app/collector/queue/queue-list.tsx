"use client";

import { useEffect, useState } from "react";
import { BinChips } from "@/components/bin-chips";
import { Icon } from "@/components/icons";
import { EmptyState, Notice } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { dismiss, listItems, syncAll, type QueueItem } from "@/lib/offline/queue";
import { useSyncStatus } from "../sync-agent";

export function QueueList({ collectorId }: { collectorId: string }) {
  const s = useSyncStatus();
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
    return <Notice tone="warn">This browser can’t save scans on the phone, so there’s nothing stored here. You need signal to save.</Notice>;
  }
  if (items === null) return <div aria-busy="true" className="skeleton h-24" />;

  const pending = items.filter((i) => i.state === "pending");
  const attention = items.filter((i) => i.state === "attention");

  return (
    <div className="space-y-6">
      {s.signedOut && pending.length > 0 && (
        <Notice tone="warn">
          You’re signed out, so these can’t be sent yet.{" "}
          <a href="/login" className="font-bold underline">Sign in</a> and they’ll send automatically.
        </Notice>
      )}
      {s.otherAccounts > 0 && (
        <Notice>
          {s.otherAccounts} saved {s.otherAccounts === 1 ? "scan belongs" : "scans belong"} to another collector account
          on this phone. {s.otherAccounts === 1 ? "It’ll" : "They’ll"} send when that account signs in.
        </Notice>
      )}

      {items.length === 0 ? (
        <EmptyState icon="check" title="Nothing waiting" body="Every scan saved on this phone has been sent." />
      ) : null}

      {attention.length > 0 && (
        <section aria-labelledby="attention-h" className="space-y-3">
          <h2 id="attention-h" className="text-lg font-bold">Needs your attention ({attention.length})</h2>
          <p className="text-sm text-slate-green">The server didn’t accept these. Read the reason, then dismiss.</p>
          <ul className="space-y-3">
            {attention.map((i) => (
              <li key={i.id} className="card space-y-3">
                <ItemHeader item={i} />
                <p className="flex gap-2 text-sm font-semibold text-danger">
                  <Icon name="warn" className="mt-px h-5 w-5 shrink-0" />
                  {i.error?.message}
                </p>
                <button type="button" onClick={() => dismiss(i.id, collectorId)} className="btn btn-outline btn-sm">
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section aria-labelledby="pending-h" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="pending-h" className="text-lg font-bold">Waiting to send ({pending.length})</h2>
            {!s.signedOut && (
              <button
                type="button"
                disabled={s.syncing}
                onClick={() => syncAll(collectorId, { force: true })}
                className="btn btn-primary btn-sm"
              >
                {s.syncing ? "Sending…" : "Send now"}
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
                    Tried {i.attempts} {i.attempts === 1 ? "time" : "times"}. Trying again automatically.
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
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-bold">{item.household ? item.household.name : "Household not confirmed yet"}</p>
        <p className="text-sm text-slate-green">
          {item.household?.code ??
            ("code" in item.payload.household ? `Typed: ${item.payload.household.code}` : "Scanned QR code")}
        </p>
      </div>
      <p className="shrink-0 text-right text-sm text-slate-green">{formatDateTime(new Date(item.payload.collectedAt))}</p>
    </div>
  );
}
