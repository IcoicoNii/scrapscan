"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { syncAll } from "@/lib/offline/queue";
import { useSyncStatus } from "./sync-agent";

/** Home page card: how many scans are saved on this phone and waiting, with Send now. */
export function SyncStatusCard({ collectorId }: { collectorId: string }) {
  const s = useSyncStatus();
  const waiting = s.pending + s.attention;

  let note: string;
  if (!s.ready) note = "Checking this phone…";
  else if (!s.storage) note = "This browser can’t save scans offline. You need signal to save.";
  else if (s.syncing) note = "Sending…";
  else if (s.signedOut && s.pending) note = "Sign in again to send them.";
  else if (s.attention) note = `${s.attention} ${s.attention === 1 ? "needs" : "need"} your attention.`;
  else if (s.pending) note = "They’ll send automatically when there’s signal.";
  else note = "Everything saved on this phone has been sent.";

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-green">Waiting to sync</p>
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
              Send now
            </button>
          )}
          <Link href="/collector/queue" className="btn btn-outline btn-sm">
            See saved scans
          </Link>
        </div>
      )}
    </div>
  );
}
