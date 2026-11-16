"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BinChips } from "@/components/bin-chips";
import { TextField } from "@/components/fields";
import { Icon } from "@/components/icons";
import { Notice } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { newCollectionId, QR_PREFIX, type CollectionInput, type HouseholdRef } from "@/lib/collection-input";
import type { CollectionSummary, HouseholdLookup } from "@/lib/collections";
import {
  dismiss,
  enqueue,
  lookupOffline,
  onItemResult,
  sendNow,
  sendUnstored,
  type SendOutcome,
} from "@/lib/offline/queue";
import { QrScanner } from "./qr-scanner";
import { useI18n } from "@/components/i18n";
import { format } from "@/lib/i18n/config";

// Find household -> check bins -> save -> result.
// Saving always writes to the phone first (offline queue), then tries to send. The score is never
// worked out here: the server decides it, and this screen shows what came back.

type Bins = CollectionInput["bins"];
type Household = { code: string; name: string; purok: string; address?: string };
/** null household = not confirmed (scanned offline, not on this phone's list yet). */
type MaybeHousehold = Household | null;
type QueuedReason = "offline" | "signed-out" | "forbidden";

type State =
  | { step: "find"; message?: string }
  | { step: "looking"; ref: HouseholdRef }
  | { step: "already"; household: Household; collectedAt?: string; score?: number; fromPhone: boolean }
  | { step: "check"; ref: HouseholdRef; household: MaybeHousehold; offline: boolean }
  | { step: "saving"; payload: CollectionInput; household: MaybeHousehold }
  | { step: "queued"; payload: CollectionInput; household: MaybeHousehold; reason: QueuedReason }
  // Only when this browser can't store scans: the payload is frozen so Try again resends the same id.
  | { step: "failed"; payload: CollectionInput; household: MaybeHousehold; message: string }
  | { step: "rejected"; household: MaybeHousehold; message: string; collection?: CollectionSummary }
  | { step: "done"; collection: CollectionSummary };

const BINS = ["biodegradable", "recyclable", "residual"] as const;

const LOOKUP_TIMEOUT_MS = 6000; // weak signal: fall back to the phone's list instead of waiting

/** Online lookup. null = couldn't reach the server (offline, timeout, signed out, server error). */
async function lookupOnline(ref: HouseholdRef): Promise<HouseholdLookup | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch("/api/households/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.status === 401 || res.status >= 500) return null;
    const json = (await res.json().catch(() => null)) as HouseholdLookup | null;
    return json && "ok" in json ? json : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function ScanFlow({ collectorId }: { collectorId: string }) {
  const [state, setState] = useState<State>({ step: "find" });
  const [code, setCode] = useState("");
  const { t, intl } = useI18n();
  const c = t.collector;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to each new step's heading so screen readers and keyboard users follow along.
  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  // While "Saved on this phone" is showing, switch to the result if it sends in the background.
  const queuedId = state.step === "queued" ? state.payload.id : null;
  const queuedHousehold = state.step === "queued" ? state.household : null;
  useEffect(() => {
    if (!queuedId) return;
    return onItemResult((id, o) => {
      if (id !== queuedId) return;
      if (o.kind === "sent") setState({ step: "done", collection: o.collection });
      if (o.kind === "rejected") {
        dismiss(id, collectorId); // the collector is reading the reason right now
        setState({ step: "rejected", household: queuedHousehold, message: o.message, collection: o.collection });
      }
    });
  }, [queuedId, queuedHousehold, collectorId]);

  const lookup = useCallback(
    async (ref: HouseholdRef) => {
      setState({ step: "looking", ref });
      const r = await lookupOnline(ref);
      if (r) {
        if (!r.ok) return setState({ step: "find", message: r.message });
        if (r.collectedToday) {
          const c = r.collectedToday;
          return setState({ step: "already", household: r.household, collectedAt: c.collectedAt, score: c.score, fromPhone: false });
        }
        return setState({ step: "check", ref, household: r.household, offline: false });
      }

      // Couldn't reach the server: use the list saved on this phone.
      const off = await lookupOffline(collectorId, ref).catch(() => ({ found: false as const, haveList: false }));
      if (off.found) {
        const { code: hc, name, purok } = off.household;
        const household = { code: hc, name, purok };
        if (off.collectedToday) return setState({ step: "already", household, fromPhone: true });
        return setState({ step: "check", ref, household, offline: true });
      }
      if ("code" in ref && off.haveList) {
        return setState({ step: "find", message: c.notOnList });
      }
      // A QR not on the list (maybe a new household) or no list at all: save it unconfirmed.
      setState({ step: "check", ref, household: null, offline: true });
    },
    [collectorId, c.notOnList],
  );

  const onScan = useCallback(
    (text: string) => {
      const token = text.trim();
      if (!token.startsWith(QR_PREFIX)) {
        return setState({ step: "find", message: c.notScrapScan });
      }
      lookup({ qrToken: token });
    },
    [lookup, c.notScrapScan],
  );

  const show = useCallback(
    (o: SendOutcome, payload: CollectionInput, household: MaybeHousehold) => {
      switch (o.kind) {
        case "sent":
          return setState({ step: "done", collection: o.collection });
        case "rejected":
          dismiss(payload.id, collectorId);
          return setState({ step: "rejected", household, message: o.message, collection: o.collection });
        case "queued":
          return setState({ step: "queued", payload, household, reason: "offline" });
        default:
          return setState({ step: "queued", payload, household, reason: o.kind });
      }
    },
    [collectorId],
  );

  const sendWithoutStorage = useCallback(async (payload: CollectionInput, household: MaybeHousehold) => {
    setState({ step: "saving", payload, household });
    const o = await sendUnstored(payload);
    if (o.kind === "sent") return setState({ step: "done", collection: o.collection });
    if (o.kind === "rejected") return setState({ step: "rejected", household, message: o.message, collection: o.collection });
    setState({
      step: "failed",
      payload,
      household,
      message: o.kind === "signed-out" ? c.signedOutRetry : c.noConnection,
    });
  }, [c.signedOutRetry, c.noConnection]);

  const save = useCallback(
    async (ref: HouseholdRef, household: MaybeHousehold, bins: Bins) => {
      const payload: CollectionInput = { id: newCollectionId(), household: ref, collectedAt: new Date().toISOString(), bins };
      setState({ step: "saving", payload, household });
      const stored = await enqueue({
        id: payload.id,
        collectorId,
        payload,
        household: household && { code: household.code, name: household.name, purok: household.purok },
      });
      if (!stored) return sendWithoutStorage(payload, household);
      show(await sendNow(payload.id, collectorId), payload, household);
    },
    [collectorId, sendWithoutStorage, show],
  );

  const reset = () => {
    setCode("");
    setState({ step: "find" });
  };

  const heading = (text: string) => (
    <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight">
      {text}
    </h2>
  );

  const scanNext = (
    <button type="button" onClick={reset} className="btn btn-primary w-full py-4 text-lg">
      <Icon name="qr" className="h-6 w-6" />
      {c.scanNext}
    </button>
  );

  switch (state.step) {
    case "find":
    case "looking":
      return (
        <div className="space-y-5">
          {heading(state.step === "looking" ? c.finding : c.scanTitle)}
          {state.step === "find" && state.message && <Notice tone="warn">{state.message}</Notice>}
          {state.step === "find" ? (
            <QrScanner onScan={onScan} />
          ) : (
            <div aria-busy="true" className="skeleton aspect-square w-full rounded-3xl" />
          )}
          <form
            className="card space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) lookup({ code: code.trim() });
            }}
          >
            <TextField
              label={c.typeLabel}
              hint={c.typeHint}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              disabled={state.step === "looking"}
            />
            <button type="submit" className="btn btn-outline w-full" disabled={state.step === "looking" || !code.trim()}>
              <Icon name="search" className="h-5 w-5" />
              {c.find}
            </button>
          </form>
        </div>
      );

    case "already":
      return (
        <div className="space-y-5">
          {heading(c.alreadyTitle)}
          <HouseholdCard household={state.household} />
          <Notice>
            {state.fromPhone
              ? c.alreadyFromPhone
              : format(c.alreadyAt, { time: formatDateTime(new Date(state.collectedAt!), intl), n: state.score ?? 0 })}{" "}
            {c.onePerDay}
          </Notice>
          {scanNext}
        </div>
      );

    case "check":
      return (
        <Checklist
          key={state.household?.code ?? "unconfirmed"}
          household={state.household}
          offline={state.offline}
          onBack={reset}
          onSubmit={(bins) => save(state.ref, state.household, bins)}
          headingRef={headingRef}
        />
      );

    case "saving":
      return (
        <div className="space-y-5" aria-busy="true">
          {heading(c.savingTitle)}
          <HouseholdCard household={state.household} />
          <BinChips bins={state.payload.bins} />
        </div>
      );

    case "queued":
      return (
        <div className="space-y-5">
          {heading(c.queuedTitle)}
          <HouseholdCard household={state.household} />
          <BinChips bins={state.payload.bins} />
          <Notice>
            {state.reason === "signed-out" ? c.queuedSignedOut : state.reason === "forbidden" ? c.queuedForbidden : c.queuedOffline}
          </Notice>
          <div className="grid gap-3">
            {scanNext}
            {state.reason === "signed-out" && (
              <a href="/login" className="btn btn-outline w-full">
                {t.common.signIn}
              </a>
            )}
            <Link href="/collector/queue" className="btn btn-ghost w-full">
              {c.seeSaved}
            </Link>
          </div>
        </div>
      );

    case "failed":
      return (
        <div className="space-y-5">
          {heading(c.failedTitle)}
          <HouseholdCard household={state.household} />
          <Notice tone="warn">{state.message}</Notice>
          <BinChips bins={state.payload.bins} />
          <div className="grid gap-3">
            <button type="button" onClick={() => sendWithoutStorage(state.payload, state.household)} className="btn btn-primary w-full py-4 text-lg">
              {t.common.tryAgain}
            </button>
            <button type="button" onClick={reset} className="btn btn-ghost w-full">
              {c.discard}
            </button>
          </div>
        </div>
      );

    case "rejected":
      return (
        <div className="space-y-5">
          {heading(c.rejectedTitle)}
          <HouseholdCard household={state.household} />
          <Notice tone="warn">{state.message}</Notice>
          {state.collection && (
            <div className="card space-y-2">
              <p className="text-sm font-semibold text-slate-green">
                {format(c.recordedCollection, { time: formatDateTime(new Date(state.collection.collectedAt), intl) })}
              </p>
              <p className="font-bold">{format(c.nPoints, { n: state.collection.score })}</p>
            </div>
          )}
          {scanNext}
        </div>
      );

    case "done": {
      const col = state.collection;
      return (
        <div className="space-y-5">
          {heading(c.savedDone)}
          <section className="surface-forest rounded-[1.75rem] p-6 text-center shadow-lift">
            <p className="text-sm font-semibold text-mint">
              {col.householdName} · {col.householdCode}
            </p>
            <p className="mt-2 text-5xl font-extrabold tabular-nums">{col.score > 0 ? `+${col.score}` : "0"}</p>
            <p className="mt-1 text-white/90">
              {col.score > 0 ? c.pointsForHousehold : c.noPoints}
            </p>
          </section>
          <button type="button" onClick={reset} className="btn btn-lawn w-full py-5 text-lg">
            <Icon name="qr" className="h-7 w-7" />
            {c.scanNext}
          </button>
          <Link href="/collector" className="btn btn-ghost w-full">
            {t.common.backToHome}
          </Link>
        </div>
      );
    }
  }
}

function HouseholdCard({ household }: { household: MaybeHousehold }) {
  const { t } = useI18n();
  if (!household) {
    return (
      <div className="card flex items-start gap-4">
        <span className="icon-tile h-12 w-12 shrink-0 rounded-2xl">
          <Icon name="info" className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">{t.collector.notConfirmed}</p>
          <p className="mt-0.5 text-sm text-slate-green">{t.collector.notConfirmedBody}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="card flex items-start gap-4">
      <span className="icon-tile h-12 w-12 shrink-0 rounded-2xl">
        <Icon name="home" className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{household.name}</p>
        <p className="text-sm font-semibold text-forest">{household.code}</p>
        <p className="mt-0.5 text-sm text-slate-green">
          {household.address ? `${household.address} · ` : ""}
          {household.purok}
        </p>
      </div>
    </div>
  );
}

function Checklist({
  household,
  offline,
  onBack,
  onSubmit,
  headingRef,
}: {
  household: MaybeHousehold;
  offline: boolean;
  onBack: () => void;
  onSubmit: (bins: Bins) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  // No defaults: each bin has to be checked on purpose.
  const [bins, setBins] = useState<Partial<Bins>>({});
  const complete = BINS.every((b) => bins[b]);
  const { t } = useI18n();
  const c = t.collector;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) onSubmit(bins as Bins);
      }}
    >
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight">
        {c.checkBins}
      </h2>
      {offline && (
        <Notice>{c.offlineCheck}</Notice>
      )}
      <HouseholdCard household={household} />
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm -mt-2">
        <Icon name="arrow-left" className="h-5 w-5" />
        {c.wrongHousehold}
      </button>

      {BINS.map((b) => (
        <fieldset key={b} className="card">
          <legend className="text-lg font-bold">{t.bins[b]}</legend>
          <p className="text-sm text-slate-green">{t.bins[`${b}Hint`]}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(["CORRECT", "CONTAMINATED"] as const).map((v) => {
              const ok = v === "CORRECT";
              const checked = bins[b] === v;
              return (
                <label
                  key={v}
                  className={`flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-3 text-center font-bold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-lawn ${
                    checked
                      ? ok
                        ? "border-forest bg-mint text-forest"
                        : "border-danger bg-danger-soft text-danger"
                      : "border-line bg-white text-slate-green hover:border-slate-green"
                  }`}
                >
                  <input
                    type="radio"
                    name={b}
                    value={v}
                    checked={checked}
                    onChange={() => setBins((s) => ({ ...s, [b]: v }))}
                    className="sr-only"
                  />
                  <Icon name={ok ? "check" : "warn"} className="h-6 w-6 shrink-0" />
                  {ok ? t.bins.correct : t.bins.contaminated}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <button type="submit" disabled={!complete} aria-describedby="submit-note" className="btn btn-primary w-full py-5 text-lg">
        {c.saveCollection}
      </button>
      <p id="submit-note" className="-mt-2 text-center text-sm text-slate-green">
        {complete ? c.serverScores : c.chooseAll}
      </p>
    </form>
  );
}
