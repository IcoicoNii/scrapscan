"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BinChips } from "@/components/bin-chips";
import { TextField } from "@/components/fields";
import { Icon } from "@/components/icons";
import { Notice } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { newCollectionId, QR_PREFIX, type CollectionInput, type HouseholdRef } from "@/lib/collection-input";
import type { CollectionSummary, HouseholdLookup, RecordResult } from "@/lib/collections";
import { QrScanner } from "./qr-scanner";

// Find household -> check bins -> send -> result. The score is never worked out here: the server
// decides it and this screen shows what came back.

type Bins = CollectionInput["bins"];
type Household = Extract<HouseholdLookup, { ok: true }>["household"];

type State =
  | { step: "find"; message?: string }
  | { step: "looking"; ref: HouseholdRef }
  | { step: "already"; household: Household; collection: CollectionSummary }
  | { step: "check"; ref: HouseholdRef; household: Household }
  | { step: "sending"; payload: CollectionInput; household: Household }
  // `payload` is frozen once sent: a retry must resend exactly the same id and details.
  | { step: "failed"; payload: CollectionInput; household: Household; message: string; retry: boolean; signedOut?: boolean }
  | { step: "rejected"; household: Household; message: string; collection?: CollectionSummary }
  | { step: "done"; collection: CollectionSummary };

const BINS: { key: keyof Bins; label: string; hint: string }[] = [
  { key: "biodegradable", label: "Biodegradable", hint: "Food scraps, leaves, garden waste" },
  { key: "recyclable", label: "Recyclable", hint: "Clean plastic, paper, cans, bottles" },
  { key: "residual", label: "Residual", hint: "Everything that can’t be composted or recycled" },
];

const NO_SIGNAL = "No connection. Move to a spot with signal and try again.";

async function postJson<T>(url: string, body: unknown): Promise<{ status: number; json: T | null } | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as T | null;
    return { status: res.status, json };
  } catch {
    return null; // network error
  }
}

export function ScanFlow() {
  const [state, setState] = useState<State>({ step: "find" });
  const [code, setCode] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to each new step's heading so screen readers and keyboard users follow along.
  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  const lookup = useCallback(async (ref: HouseholdRef) => {
    setState({ step: "looking", ref });
    const res = await postJson<HouseholdLookup>("/api/households/lookup", ref);
    if (!res) return setState({ step: "find", message: NO_SIGNAL });
    if (res.status === 401) return setState({ step: "find", message: "You’ve been signed out. Sign in again to keep scanning." });
    const r = res.json;
    if (!r || !("ok" in r)) return setState({ step: "find", message: "Something went wrong. Try again." });
    if (!r.ok) return setState({ step: "find", message: r.message });
    if (r.collectedToday) return setState({ step: "already", household: r.household, collection: r.collectedToday });
    setState({ step: "check", ref, household: r.household });
  }, []);

  const onScan = useCallback(
    (text: string) => {
      const token = text.trim();
      if (!token.startsWith(QR_PREFIX)) {
        return setState({ step: "find", message: "That isn’t a ScrapScan QR code. Scan the code on the household’s container." });
      }
      lookup({ qrToken: token });
    },
    [lookup],
  );

  const send = useCallback(async (payload: CollectionInput, household: Household) => {
    setState({ step: "sending", payload, household });
    const res = await postJson<RecordResult>("/api/collections", payload);
    if (!res) return setState({ step: "failed", payload, household, message: NO_SIGNAL, retry: true });
    if (res.status === 401) {
      return setState({
        step: "failed", payload, household, retry: true, signedOut: true,
        message: "You’ve been signed out. Sign in again in a new tab, then come back and tap Try again.",
      });
    }
    const r = res.json;
    if (res.status >= 500 || !r || !("ok" in r)) {
      return setState({ step: "failed", payload, household, message: "The server had a problem. Try again in a moment.", retry: true });
    }
    if (r.ok) return setState({ step: "done", collection: r.collection });
    setState({ step: "rejected", household, message: r.message, collection: r.collection });
  }, []);

  const reset = () => {
    setCode("");
    setState({ step: "find" });
  };

  const heading = (text: string) => (
    <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight">
      {text}
    </h2>
  );

  switch (state.step) {
    case "find":
    case "looking":
      return (
        <div className="space-y-5">
          {heading(state.step === "looking" ? "Finding household…" : "Scan the household QR")}
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
              label="Or type the household number"
              hint="Printed under the QR code, for example 42 or HH-00042."
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
              Find household
            </button>
          </form>
        </div>
      );

    case "already":
      return (
        <div className="space-y-5">
          {heading("Already collected today")}
          <HouseholdCard household={state.household} />
          <Notice>
            This household was collected at {formatDateTime(new Date(state.collection.collectedAt))} and earned{" "}
            {state.collection.score} points. Only one collection per household is recorded each day.
          </Notice>
          <button type="button" onClick={reset} className="btn btn-primary w-full py-4 text-lg">
            <Icon name="qr" className="h-6 w-6" />
            Scan next household
          </button>
        </div>
      );

    case "check":
      return <Checklist key={state.household.code} household={state.household} onBack={reset} onSubmit={(bins) =>
        send({ id: newCollectionId(), household: state.ref, collectedAt: new Date().toISOString(), bins }, state.household)
      } headingRef={headingRef} />;

    case "sending":
      return (
        <div className="space-y-5" aria-busy="true">
          {heading("Saving…")}
          <HouseholdCard household={state.household} />
          <BinChips bins={state.payload.bins} />
        </div>
      );

    case "failed":
      return (
        <div className="space-y-5">
          {heading("Not saved yet")}
          <HouseholdCard household={state.household} />
          <Notice tone="warn">{state.message}</Notice>
          <BinChips bins={state.payload.bins} />
          <div className="grid gap-3">
            {state.retry && (
              <button type="button" onClick={() => send(state.payload, state.household)} className="btn btn-primary w-full py-4 text-lg">
                Try again
              </button>
            )}
            {state.signedOut && (
              <a href="/login" target="_blank" rel="noopener" className="btn btn-outline w-full">
                Sign in (opens a new tab)
              </a>
            )}
            <button type="button" onClick={reset} className="btn btn-ghost w-full">
              Discard and scan another
            </button>
          </div>
        </div>
      );

    case "rejected":
      return (
        <div className="space-y-5">
          {heading("Couldn’t record this")}
          <HouseholdCard household={state.household} />
          <Notice tone="warn">{state.message}</Notice>
          {state.collection && (
            <div className="card space-y-2">
              <p className="text-sm font-semibold text-slate-green">
                Recorded collection · {formatDateTime(new Date(state.collection.collectedAt))}
              </p>
              <p className="font-bold">{state.collection.score} points</p>
            </div>
          )}
          <button type="button" onClick={reset} className="btn btn-primary w-full py-4 text-lg">
            <Icon name="qr" className="h-6 w-6" />
            Scan next household
          </button>
        </div>
      );

    case "done": {
      const c = state.collection;
      return (
        <div className="space-y-5">
          {heading("Collection saved")}
          <section className="surface-forest rounded-[1.75rem] p-6 text-center shadow-lift">
            <p className="text-sm font-semibold text-mint">
              {c.householdName} · {c.householdCode}
            </p>
            <p className="mt-2 text-5xl font-extrabold tabular-nums">{c.score > 0 ? `+${c.score}` : "0"}</p>
            <p className="mt-1 text-white/90">
              {c.score > 0 ? "points for this household" : "No points this time: two or more bins were contaminated."}
            </p>
          </section>
          <button type="button" onClick={reset} className="btn btn-lawn w-full py-5 text-lg">
            <Icon name="qr" className="h-7 w-7" />
            Scan next household
          </button>
          <Link href="/collector" className="btn btn-ghost w-full">
            Back to home
          </Link>
        </div>
      );
    }
  }
}

function HouseholdCard({ household }: { household: Household }) {
  return (
    <div className="card flex items-start gap-4">
      <span className="icon-tile h-12 w-12 shrink-0 rounded-2xl">
        <Icon name="home" className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{household.name}</p>
        <p className="text-sm font-semibold text-forest">{household.code}</p>
        <p className="mt-0.5 text-sm text-slate-green">
          {household.address} · {household.purok}
        </p>
      </div>
    </div>
  );
}

function Checklist({
  household,
  onBack,
  onSubmit,
  headingRef,
}: {
  household: Household;
  onBack: () => void;
  onSubmit: (bins: Bins) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  // No defaults: each bin has to be checked on purpose.
  const [bins, setBins] = useState<Partial<Bins>>({});
  const complete = BINS.every((b) => bins[b.key]);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) onSubmit(bins as Bins);
      }}
    >
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight">
        Check the bins
      </h2>
      <HouseholdCard household={household} />
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm -mt-2">
        <Icon name="arrow-left" className="h-5 w-5" />
        Wrong household? Scan again
      </button>

      {BINS.map((b) => (
        <fieldset key={b.key} className="card">
          <legend className="text-lg font-bold">{b.label}</legend>
          <p className="text-sm text-slate-green">{b.hint}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(["CORRECT", "CONTAMINATED"] as const).map((v) => {
              const ok = v === "CORRECT";
              const checked = bins[b.key] === v;
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
                    name={b.key}
                    value={v}
                    checked={checked}
                    onChange={() => setBins((s) => ({ ...s, [b.key]: v }))}
                    className="sr-only"
                  />
                  <Icon name={ok ? "check" : "warn"} className="h-6 w-6 shrink-0" />
                  {ok ? "Correct" : "Contaminated"}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <button type="submit" disabled={!complete} aria-describedby="submit-note" className="btn btn-primary w-full py-5 text-lg">
        Save collection
      </button>
      <p id="submit-note" className="-mt-2 text-center text-sm text-slate-green">
        {complete ? "Points are worked out on the server when you save." : "Choose Correct or Contaminated for all three bins."}
      </p>
    </form>
  );
}
