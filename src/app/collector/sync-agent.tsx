"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { enforceDirectoryOwner, refreshCounts, refreshDirectory, syncAll, syncStatus } from "@/lib/offline/queue";

export const useSyncStatus = () => useSyncExternalStore(syncStatus.subscribe, syncStatus.get, syncStatus.server);

const TICK_MS = 15_000; // checks for items whose retry time has come; cheap when the queue is empty

// Runs on every collector page: keeps the household list fresh, sends waiting scans whenever there's
// a chance (page open, back online, back to the app, timer), and shows a banner while scans wait.
export function SyncAgent({ collectorId }: { collectorId: string }) {
  const pathname = usePathname();
  const s = useSyncStatus();

  useEffect(() => {
    let cancelled = false;
    const kick = (force: boolean) => {
      if (cancelled) return;
      syncAll(collectorId, { force });
      refreshDirectory(collectorId);
    };

    (async () => {
      await enforceDirectoryOwner(collectorId); // someone else's list never shows here
      await refreshCounts(collectorId);
      navigator.storage?.persist?.().catch(() => {}); // ask the browser not to evict saved scans
      kick(true);
    })();

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => reg.active?.postMessage({ type: "warm" }))
        .catch(() => {});
    }

    const onOnline = () => kick(true);
    const onVisible = () => document.visibilityState === "visible" && kick(false);
    const timer = setInterval(() => syncAll(collectorId), TICK_MS);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [collectorId]);

  if (pathname === "/collector/queue" || !s.ready) return null;

  let tone: "warn" | "info" | null = null;
  let text = "";
  if (s.signedOut && s.pending > 0) {
    tone = "warn";
    text = `You’re signed out. Sign in to send ${s.pending} saved ${s.pending === 1 ? "scan" : "scans"}.`;
  } else if (s.attention > 0) {
    tone = "warn";
    text = `${s.attention} saved ${s.attention === 1 ? "scan needs" : "scans need"} your attention.`;
  } else if (s.pending > 0) {
    tone = "info";
    text = `${s.pending} ${s.pending === 1 ? "scan is" : "scans are"} waiting to send. They’ll go automatically when there’s signal.`;
  }
  if (!tone) return null;

  return (
    <div role="status" className="mb-5">
      <Link
        href={s.signedOut && s.pending > 0 ? "/login" : "/collector/queue"}
        className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
          tone === "warn" ? "border-danger/15 bg-danger-soft text-danger" : "border-moss/20 bg-cream/70 text-khaki"
        }`}
      >
        <Icon name={tone === "warn" ? "warn" : "clock"} className="h-5 w-5 shrink-0" />
        <span className="flex-1">{text}</span>
        <Icon name="chevron-right" className="h-5 w-5 shrink-0" />
      </Link>
    </div>
  );
}
