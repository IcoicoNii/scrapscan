"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { syncAll } from "@/lib/offline/queue";
import { useSyncStatus } from "./sync-agent";
import { useI18n } from "@/components/i18n";
import { plural } from "@/lib/i18n/config";

/** Home page card: how many scans are saved on this phone and waiting, with Send now. */
export function SyncStatusCard({ collectorId }: { collectorId: string }) {
  const s = useSyncStatus();
  const { t } = useI18n();
  const c = t.collector;
  const waiting = s.pending + s.attention;

  let note: string;
  if (!s.ready) note = c.checking;
  else if (!s.storage) note = c.noStorage;
  else if (s.syncing) note = t.common.sending;
  else if (s.signedOut && s.pending) note = c.signInToSend;
  else if (s.attention) note = plural(s.attention, c.attentionOne, c.attentionOther);
  else if (s.pending) note = c.willSend;
  else note = c.allSent;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-green">{c.waitingToSync}</p>
        <span className="icon-tile h-10 w-10">
          <Icon name="clock" className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-4xl font-extrabold tracking-tight tabular-nums text-forest">{s.ready ? waiting : "–"}</p>
      <p aria-live="polite" className="mt-1 text-sm text-slate-green">{note}</p>
      {waiting > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {s.pending > 0 && !s.signedOut && (
            <button
              type="button"
              disabled={s.syncing}
              onClick={() => syncAll(collectorId, { force: true })}
              className="btn btn-primary btn-sm"
            >
              {t.common.sendNow}
            </button>
          )}
          <Link href="/collector/queue" className="btn btn-outline btn-sm">
            {c.seeSaved}
          </Link>
        </div>
      )}
    </div>
  );
}
