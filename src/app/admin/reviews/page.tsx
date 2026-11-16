import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { flaggedForReview, recentDecisions, type FlaggedForReview, type RecentDecision } from "@/lib/reviews";
import { BinResultLabel } from "@/components/bin-chips";
import { Icon } from "@/components/icons";
import { EmptyState, Notice, PageHeader, SectionCard } from "@/components/ui";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ reviewed?: string }> }) {
  await requirePagePermission("collection:review");
  const { reviewed } = await searchParams;
  const [flagged, recent, [justDone]] = await Promise.all([
    flaggedForReview(),
    recentDecisions({ limit: 10 }),
    // Read back from the audit log, so only a real decision can produce the message.
    reviewed && /^[0-9a-f-]{36}$/i.test(reviewed) ? recentDecisions({ collectionId: reviewed, limit: 1 }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description={
          flagged.length === 0
            ? "Collections that need a decision show up here."
            : `${flagged.length} flagged ${flagged.length === 1 ? "collection needs" : "collections need"} a decision. Their points are on hold until you decide.`
        }
      />

      {justDone && (
        <div role="status" className="rounded-2xl border border-forest/15 bg-mint/70 p-4">
          <p className="font-bold">
            {justDone.household?.code ?? "Collection"}: {justDone.decision === "release" ? "points released" : "not counted"}
          </p>
          <p className="mt-1 text-sm">{decisionSentence(justDone)}</p>
        </div>
      )}

      {flagged.length === 0 ? (
        <EmptyState
          icon="check"
          title="Nothing to review"
          body="A collection is flagged when a phone sends the same scan again with different details. You'll decide here whether its points count."
        />
      ) : (
        <>
          <Notice>
            Compare what was saved with what was sent again, and ask the collector what happened if it isn’t clear.
            Release the points if the saved result is right. Don’t count it if you can’t confirm the bins.
          </Notice>
          <ul className="space-y-4">
            {flagged.map((c) => (
              <li key={c.id}>
                <FlaggedCard c={c} />
              </li>
            ))}
          </ul>
        </>
      )}

      {recent.length > 0 && (
        <SectionCard id="recent" title="Recent decisions">
          <ul className="divide-y divide-line-soft">
            {recent.map((d) => (
              <li key={d.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold">
                    {d.household ? `${d.household.code} · ${d.household.name}` : "Removed collection"}
                  </span>
                  <DecisionBadge decision={d.decision} />
                </p>
                <p className="text-sm text-slate-green">
                  {d.adminName} · {formatDateTime(d.decidedAt)}
                  {d.points > 0 && ` · ${d.points} pts ${d.decision === "release" ? "released" : "not counted"}`}
                </p>
                {d.reason && <p className="text-sm">“{d.reason}”</p>}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function decisionSentence(d: RecentDecision) {
  if (d.decision === "release") {
    return d.points > 0
      ? `${d.points} points are back in the household’s balance, and the collection counts as verified.`
      : "The collection counts as verified. It scored 0, so there were no points to release.";
  }
  return d.points > 0
    ? `The ${d.points} held points stay off the household’s balance. The collection stays on record as not counted.`
    : "The collection stays on record as not counted.";
}

function DecisionBadge({ decision }: { decision: "release" | "reject" }) {
  const release = decision === "release";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${
        release ? "bg-mint text-forest ring-forest/15" : "bg-danger-soft text-danger ring-danger/20"
      }`}
    >
      <Icon name={release ? "check" : "warn"} className="h-3.5 w-3.5" />
      {release ? "Released" : "Not counted"}
    </span>
  );
}

const BIN_ROWS = [
  ["Biodegradable", "biodegradable"],
  ["Recyclable", "recyclable"],
  ["Residual", "residual"],
] as const;

function FlaggedCard({ c }: { c: FlaggedForReview }) {
  const r = c.received;
  const headingId = `flag-${c.id}`;
  const rows: { label: string; saved: React.ReactNode; resent: React.ReactNode; differs: boolean }[] = r
    ? [
        {
          label: "Household",
          saved: c.household.code,
          resent: r.householdCode ?? (r.via === "qr" ? "Unknown QR code" : "Unknown number"),
          differs: r.householdCode !== c.household.code,
        },
        {
          label: "Collected",
          saved: formatDateTime(c.collectedAt),
          resent: formatDateTime(r.collectedAt),
          // Minutes are all the screen shows, so compare at that precision too.
          differs: Math.floor(+r.collectedAt / 60_000) !== Math.floor(+c.collectedAt / 60_000),
        },
        ...BIN_ROWS.map(([label, key]) => ({
          label,
          saved: <BinResultLabel result={c.bins[key]} />,
          resent: <BinResultLabel result={r.bins[key]} />,
          differs: c.bins[key] !== r.bins[key],
        })),
        { label: "Points", saved: c.score, resent: r.score, differs: c.score !== r.score },
      ]
    : [];
  const nothingVisible = r && rows.every((row) => !row.differs);

  return (
    <article aria-labelledby={headingId} className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-bold">
            {c.household.code} · {c.household.name}
          </h2>
          <p className="text-sm text-slate-green">
            {c.household.purok} · Collected by {c.collector.name} on {formatDateTime(c.collectedAt)}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cream px-3 py-1 text-sm font-bold text-khaki ring-1 ring-inset ring-moss/25">
          <Icon name="clock" className="h-4 w-4" />
          {c.pointsHeld > 0 ? `${c.pointsHeld} pts on hold` : "No points held"}
        </span>
      </div>

      <p className="flex items-start gap-2 text-sm font-semibold text-danger">
        <Icon name="flag" className="mt-px h-4 w-4 shrink-0" />
        <span>
          {c.flagReason ?? "Flagged for review."}
          {c.flaggedAt && <span className="font-normal text-slate-green"> Flagged {formatDateTime(c.flaggedAt)}.</span>}
        </span>
      </p>

      {r && (
        // Phones: one block per detail, so both values are always visible. md+: a side-by-side table.
        <dl className="divide-y divide-line-soft rounded-2xl border border-line md:hidden">
          {rows.map((row) => (
            <div key={row.label} className={`space-y-1 px-3 py-2.5 text-sm ${row.differs ? "bg-cream/60" : ""}`}>
              <dt className="flex items-baseline justify-between gap-3 font-semibold">
                {row.label}
                {row.differs && <span className="text-xs font-bold text-danger">Different</span>}
              </dt>
              <dd className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1">
                <span className="text-slate-green">Saved</span>
                <span>{row.saved}</span>
                <span className="text-slate-green">Sent again</span>
                <span>{row.resent}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {r ? (
        <div className="hidden table-wrap md:block">
          <table className="data-table text-sm">
            <caption className="sr-only">
              What was saved for {c.household.code} compared with what was sent again
            </caption>
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2.5"><span className="sr-only">Detail</span></th>
                <th scope="col" className="px-3 py-2.5">Saved (counts)</th>
                <th scope="col" className="px-3 py-2.5">Sent again</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className={row.differs ? "bg-cream/60" : undefined}>
                  <th scope="row" className="px-3 py-2.5 font-semibold">
                    {row.label}
                    {row.differs && <span className="mt-0.5 block text-xs font-bold text-danger">Different</span>}
                  </th>
                  <td className="px-3 py-2.5">{row.saved}</td>
                  <td className="px-3 py-2.5">{row.resent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-green">
          The second send wasn’t recorded for this collection (it was flagged before ScrapScan kept those details). Ask the
          collector what happened.
        </p>
      )}
      {nothingVisible && (
        <p className="text-sm text-slate-green">
          Everything shown matches. The second send found the household a different way (QR code or typed number) or differed
          by seconds, so the saved result is most likely right.
        </p>
      )}

      <ReviewForm collectionId={c.id} pointsHeld={c.pointsHeld} />
    </article>
  );
}
