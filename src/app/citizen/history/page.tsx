import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDateTime, formatPoints } from "@/lib/format";
import { BinChips, BinResultLabel } from "@/components/bin-chips";
import { CollectionPoints, CollectionStatusLabel, CollectionStatusNote } from "@/components/collection-status";
import { getI18n } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/config";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Collection history" };

export default async function HistoryPage() {
  const user = await requirePagePermission("collection:read:own");
  const { t, intl } = await getI18n();
  const tc = t.citizen;
  const rows = user.householdId
    ? await db.collection.findMany({
        where: { householdId: user.householdId },
        orderBy: { collectedAt: "desc" },
        take: 50,
      })
    : [];
  // Flagged (held) and rejected (not counted) collections don't count in the ledger, so they're left out here too.
  const earned = rows.reduce((sum, c) => (c.status === "VERIFIED" ? sum + c.score : sum), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={tc.historyTitle} description={tc.historyIntro} />
      {rows.length === 0 ? (
        <EmptyState
          icon="clock"
          title={tc.historyEmpty}
          body={tc.historyEmptyBody}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label={tc.shown} value={rows.length} icon="clock" />
            <StatCard label={tc.verifiedPoints} value={formatPoints(earned, intl)} icon="leaf" />
          </div>

          {/* Phones: cards. md+: a table. */}
          <ul className="space-y-3 md:hidden">
            {rows.map((c) => (
              <li key={c.id} className="card space-y-3">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold">{formatDateTime(c.collectedAt, intl)}</span>
                  <CollectionPoints status={c.status} score={c.score} />
                </p>
                <BinChips bins={c} />
                <CollectionStatusNote status={c.status} />
              </li>
            ))}
          </ul>

          <div className="hidden table-wrap md:block">
            <table className="data-table text-sm">
              <caption className="sr-only">{tc.historyTitle}</caption>
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-3">{tc.date}</th>
                  <th scope="col" className="px-4 py-3">{t.bins.biodegradable}</th>
                  <th scope="col" className="px-4 py-3">{t.bins.recyclable}</th>
                  <th scope="col" className="px-4 py-3">{t.bins.residual}</th>
                  <th scope="col" className="px-4 py-3">{tc.status}</th>
                  <th scope="col" className="px-4 py-3 text-right">{tc.points}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <th scope="row" className="px-4 py-3 font-semibold">{formatDateTime(c.collectedAt, intl)}</th>
                    <td className="px-4 py-3"><BinResultLabel result={c.biodegradable} /></td>
                    <td className="px-4 py-3"><BinResultLabel result={c.recyclable} /></td>
                    <td className="px-4 py-3"><BinResultLabel result={c.residual} /></td>
                    <td className="px-4 py-3">
                      <CollectionStatusLabel status={c.status} />
                    </td>
                    {c.status === "VERIFIED" ? (
                      <td className="px-4 py-3 text-right text-base font-extrabold tabular-nums text-forest">+{c.score}</td>
                    ) : (
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-green">
                        {c.status === "FLAGGED" ? format(t.status.onHoldShort, { n: c.score }) : "0"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
