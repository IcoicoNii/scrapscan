// The collector's offline queue (browser only).
//
// Rule 1: a collection is written to IndexedDB BEFORE it is sent, so closing the tab or losing
//         signal never loses it.
// Rule 2: a queued payload is never changed. Retries resend the exact same id and details, which
//         the server answers idempotently (never a second award).
// Rule 3: items belong to the collector who saved them. Only that collector's session sends them.
import type { CollectionInput } from "@/lib/collection-input";
import type { CollectionSummary } from "@/lib/collections";
import { manilaDateString } from "@/lib/dates";
import { idb } from "./idb";
import {
  backoffMs,
  classifyStatus,
  DIRECTORY_REFRESH_MS,
  directoryUsable,
  findInDirectory,
  toHex,
  type DirectoryHousehold,
  type DirectoryPayload,
  type StoredDirectory,
} from "./shared";

export type QueueHousehold = { code: string; name: string; purok: string };

export type QueueItem = {
  id: string; // = payload.id
  collectorId: string;
  payload: CollectionInput;
  /** For display only. null = not confirmed yet (scanned offline, not on this phone's list). */
  household: QueueHousehold | null;
  state: "pending" | "attention";
  attempts: number;
  nextAttemptAt: number;
  savedAt: number;
  error?: { code: string; message: string };
};

export type SendOutcome =
  | { kind: "sent"; collection: CollectionSummary }
  | { kind: "queued" } // will retry later (no signal / server trouble)
  | { kind: "signed-out" }
  | { kind: "forbidden" }
  | { kind: "rejected"; message: string; collection?: CollectionSummary };

// ---------- Status, for the banner / home card / queue page ----------

export type SyncStatus = {
  ready: boolean; // false until the first count from storage
  storage: boolean; // false = this browser can't store scans (some private modes)
  pending: number;
  attention: number;
  otherAccounts: number; // items saved by a different collector on this phone
  syncing: boolean;
  signedOut: boolean;
  forbidden: boolean;
  lastSentAt: number | null;
};

let status: SyncStatus = {
  ready: false, storage: true, pending: 0, attention: 0, otherAccounts: 0,
  syncing: false, signedOut: false, forbidden: false, lastSentAt: null,
};
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};
export const syncStatus = {
  subscribe: (l: () => void) => (listeners.add(l), () => void listeners.delete(l)),
  get: () => status,
  server: () => status,
};

// Results of items sent in the background, so a screen waiting on one can pick it up.
const results = new Map<string, SendOutcome>();
const resultListeners = new Set<(id: string, o: SendOutcome) => void>();
export function onItemResult(fn: (id: string, o: SendOutcome) => void) {
  resultListeners.add(fn);
  return () => void resultListeners.delete(fn);
}
const announce = (id: string, o: SendOutcome) => {
  results.set(id, o);
  resultListeners.forEach((fn) => fn(id, o));
};

// ---------- Storage helpers ----------

const DIRECTORY_KEY = "directory";

export async function listItems(collectorId: string) {
  const all = await idb.getAll<QueueItem>("queue");
  const mine = all.filter((i) => i.collectorId === collectorId).sort((a, b) => a.savedAt - b.savedAt);
  return { mine, otherAccounts: all.length - mine.length };
}

export async function refreshCounts(collectorId: string) {
  try {
    const { mine, otherAccounts } = await listItems(collectorId);
    setStatus({
      ready: true,
      storage: true,
      pending: mine.filter((i) => i.state === "pending").length,
      attention: mine.filter((i) => i.state === "attention").length,
      otherAccounts,
    });
  } catch {
    setStatus({ ready: true, storage: false });
  }
}

/** Saves a new collection on the phone. Returns false if this browser can't store it. */
export async function enqueue(item: Omit<QueueItem, "state" | "attempts" | "nextAttemptAt" | "savedAt">) {
  const full: QueueItem = { ...item, state: "pending", attempts: 0, nextAttemptAt: 0, savedAt: Date.now() };
  try {
    await idb.put("queue", full);
  } catch {
    return false;
  }
  await refreshCounts(item.collectorId);
  return true;
}

export async function dismiss(id: string, collectorId: string) {
  const item = await idb.get<QueueItem>("queue", id);
  if (item && item.collectorId === collectorId) await idb.delete("queue", id);
  await refreshCounts(collectorId);
}

// ---------- Sending ----------

async function post(payload: CollectionInput): Promise<{ status: number | null; json: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000); // weak signal: give up and retry later
  try {
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      cache: "no-store",
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  } catch {
    return { status: null, json: null };
  } finally {
    clearTimeout(timer);
  }
}

type ServerReply = { ok?: boolean; error?: string; collection?: CollectionSummary; message?: string } | null;

/** Turns an HTTP reply into an outcome, using the retry rule in classifyStatus. */
function interpret(code: number | null, json: unknown): { outcome: SendOutcome; errorCode?: string } {
  const r = json as ServerReply;
  const kind = classifyStatus(code);
  if (kind === "sent" && r?.ok && r.collection) return { outcome: { kind: "sent", collection: r.collection } };
  if (kind === "rejected") {
    return {
      outcome: { kind: "rejected", message: r?.message ?? "The server refused this collection.", collection: r?.collection },
      errorCode: String(r?.error ?? code),
    };
  }
  if (kind === "signed-out" || kind === "forbidden") return { outcome: { kind } };
  return { outcome: { kind: "queued" } }; // network, timeout, 5xx, or a 2xx we couldn't read
}

/** For browsers that can't store anything: send once, no queue. */
export async function sendUnstored(payload: CollectionInput): Promise<SendOutcome> {
  const { status: code, json } = await post(payload);
  return interpret(code, json).outcome;
}

/** Sends one stored item and updates storage. Caller must hold the sync lock. */
async function sendStored(item: QueueItem): Promise<SendOutcome> {
  const { status: code, json } = await post(item.payload);
  const { outcome: o, errorCode } = interpret(code, json);

  switch (o.kind) {
    case "sent":
      await idb.delete("queue", item.id);
      await noteCollected(item.collectorId, o.collection);
      setStatus({ lastSentAt: Date.now(), signedOut: false, forbidden: false });
      break;
    case "rejected":
      await idb.put("queue", {
        ...item,
        state: "attention",
        error: { code: errorCode ?? "REJECTED", message: o.message },
      } satisfies QueueItem);
      break;
    case "signed-out":
      setStatus({ signedOut: true });
      break;
    case "forbidden":
      setStatus({ forbidden: true });
      break;
    case "queued": {
      const attempts = item.attempts + 1;
      await idb.put("queue", { ...item, attempts, nextAttemptAt: Date.now() + backoffMs(attempts) } satisfies QueueItem);
      break;
    }
  }
  return o;
}

/** One sender at a time, across tabs (Web Locks), with an in-tab fallback. Duplicates would be safe anyway. */
let localChain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (locks) return locks.request("scrapscan-sync", fn) as Promise<T>;
  const next = localChain.then(fn, fn);
  localChain = next.catch(() => {});
  return next;
}

/** Sends a just-saved item right away, for the scan screen. */
export function sendNow(id: string, collectorId: string): Promise<SendOutcome> {
  return withLock(async () => {
    const done = results.get(id);
    if (done) return done; // the background loop got there first
    const item = await idb.get<QueueItem>("queue", id);
    if (!item || item.collectorId !== collectorId) return { kind: "queued" } as SendOutcome;
    const outcome = await sendStored(item);
    announce(id, outcome);
    await refreshCounts(collectorId);
    return outcome;
  });
}

/**
 * Sends this collector's waiting items, oldest first. `force` ignores the retry timers (used when
 * the phone comes back online or the collector taps Send now).
 */
export function syncAll(collectorId: string, { force = false } = {}) {
  return withLock(async () => {
    setStatus({ syncing: true });
    try {
      const { mine } = await listItems(collectorId);
      const due = mine.filter((i) => i.state === "pending" && (force || i.nextAttemptAt <= Date.now()));
      for (const item of due) {
        const outcome = await sendStored(item);
        announce(item.id, outcome);
        // No signal, or the session ended: stop instead of hammering the rest.
        if (outcome.kind === "queued" || outcome.kind === "signed-out" || outcome.kind === "forbidden") break;
      }
    } catch {
      // storage trouble: counts below will report it
    } finally {
      setStatus({ syncing: false });
      await refreshCounts(collectorId);
    }
  });
}

/** Soonest retry time among waiting items, for scheduling. */
export async function nextRetryAt(collectorId: string) {
  const { mine } = await listItems(collectorId).catch(() => ({ mine: [] as QueueItem[] }));
  const pending = mine.filter((i) => i.state === "pending");
  return pending.length ? Math.min(...pending.map((i) => i.nextAttemptAt)) : null;
}

// ---------- Household directory on the phone ----------

export async function getDirectory(collectorId: string) {
  const dir = await idb.get<StoredDirectory>("meta", DIRECTORY_KEY).catch(() => undefined);
  return directoryUsable(dir, collectorId, Date.now()) ? dir! : null;
}

/** Deletes the stored list if it belongs to someone else or has expired. */
export async function enforceDirectoryOwner(collectorId: string) {
  const dir = await idb.get<StoredDirectory>("meta", DIRECTORY_KEY).catch(() => undefined);
  if (dir && !directoryUsable(dir, collectorId, Date.now())) await idb.delete("meta", DIRECTORY_KEY).catch(() => {});
}

export async function refreshDirectory(collectorId: string, { force = false } = {}) {
  const current = await getDirectory(collectorId);
  if (!force && current && Date.now() - current.fetchedAt < DIRECTORY_REFRESH_MS) return;
  try {
    const res = await fetch("/api/collector/directory", { cache: "no-store" });
    if (res.status === 401) return setStatus({ signedOut: true });
    if (!res.ok) return;
    const body = (await res.json()) as DirectoryPayload;
    const stored: StoredDirectory = {
      collectorId,
      fetchedAt: Date.now(),
      generatedAt: body.generatedAt,
      households: body.households,
    };
    await idb.put("meta", stored, DIRECTORY_KEY);
  } catch {
    // offline: keep using what we have until it expires
  }
}

/** After a successful send, mark the household as collected on the stored list. */
async function noteCollected(collectorId: string, c: CollectionSummary) {
  const dir = await getDirectory(collectorId);
  if (!dir) return;
  const h = dir.households.find((x) => x.code === c.householdCode);
  if (!h || (h.lastCollectionDay && h.lastCollectionDay >= c.collectionDay)) return;
  h.lastCollectionDay = c.collectionDay;
  await idb.put("meta", dir, DIRECTORY_KEY).catch(() => {});
}

/** Hex SHA-256 of a scanned token, or null where Web Crypto isn't available (plain http). */
export async function hashToken(token: string) {
  if (!globalThis.crypto?.subtle) return null;
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

export type OfflineLookup =
  | { found: true; household: DirectoryHousehold; collectedToday: boolean }
  | { found: false; haveList: boolean };

/** Looks a household up on the phone: the stored list, plus this phone's own saved scans for today. */
export async function lookupOffline(collectorId: string, ref: { qrToken: string } | { code: string }): Promise<OfflineLookup> {
  const dir = await getDirectory(collectorId);
  if (!dir) return { found: false, haveList: false };
  let household: DirectoryHousehold | null = null;
  if ("qrToken" in ref) {
    const qrHash = await hashToken(ref.qrToken);
    household = qrHash ? findInDirectory(dir, { qrHash }) : null;
  } else {
    household = findInDirectory(dir, { code: ref.code });
  }
  if (!household) return { found: false, haveList: true };

  const today = manilaDateString(new Date());
  let collectedToday = household.lastCollectionDay === today;
  if (!collectedToday) {
    const { mine } = await listItems(collectorId).catch(() => ({ mine: [] as QueueItem[] }));
    collectedToday = mine.some(
      (i) => i.household?.code === household.code && manilaDateString(new Date(i.payload.collectedAt)) === today,
    );
  }
  return { found: true, household, collectedToday };
}

// ---------- Logout ----------

/** Clears what must not outlive the session on this phone: the household list and cached pages. */
export async function clearOnLogout() {
  await idb.delete("meta", DIRECTORY_KEY).catch(() => {});
  if (typeof caches !== "undefined") {
    const keys = await caches.keys().catch(() => [] as string[]);
    await Promise.all(keys.filter((k) => k.startsWith("scrapscan-pages")).map((k) => caches.delete(k)));
  }
}
