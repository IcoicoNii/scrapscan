import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { RANGES, bucketLabel, parseRange } from "@/lib/analytics";
import { loadAnalytics } from "@/lib/analytics-data";
import { formatPoints } from "@/lib/format";
import { BarList, ColumnChart } from "@/components/charts";
import { CHART_COLORS } from "@/lib/chart-colors";
import { Icon } from "@/components/icons";
import { PageHeader, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Analytics" };

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requirePagePermission("analytics:read");
  const range = parseRange((await searchParams).range);
  const a = await loadAnalytics(range);
  const per = a.bucket === "day" ? "day" : "week";
  const dayLabel = (d: string) => bucketLabel(d, "day");

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="How the program is doing: who’s being collected, how well households sort, and where points go." />

      {/* One filter row, above everything it scopes. */}
      <nav aria-label="Time range" className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/analytics?range=${r}`}
            aria-current={r === range ? "page" : undefined}
            className={`btn btn-sm ${r === range ? "btn-primary" : "btn-secondary"}`}
          >
            {r === range && <Icon name="check" className="h-4 w-4" />}
            Last {r} days
          </Link>
        ))}
      </nav>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li>
          <StatCard
            label="Households reached"
            value={pct(a.summary.reachRate)}
            note={`of ${a.summary.activeHouseholds} active households were collected at least once`}
            icon="houses"
          />
        </li>
        <li>
          <StatCard label="Sorted correctly" value={pct(a.summary.cleanRate)} note={`of ${formatPoints(a.summary.verified)} verified collections scored 10`} icon="check" />
        </li>
        <li><StatCard label="Points earned" value={formatPoints(a.summary.earned)} note="from verified collections" icon="leaf" /></li>
        <li>
          <StatCard label="Points spent" value={formatPoints(a.summary.spent)} note={`on rewards picked up · ${formatPoints(a.outstanding)} held by households now`} icon="gift" />
        </li>
      </ul>

      <section className="card" aria-label="Collections per day">
        <ColumnChart
          title="Households collected per day"
          description={`Out of ${a.summary.activeHouseholds} active households. Flagged collections count; ones that were not counted don’t.`}
          columns={a.perDay.map((d) => ({ key: d.day, label: dayLabel(d.day), values: [d.collected] }))}
          series={[{ name: "Households collected", color: CHART_COLORS.primary }]}
          emptyText="No collections in this period yet."
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card" aria-label="Sorting quality">
          <ColumnChart
            title={`Sorting quality per ${per}`}
            description={`Share of verified collections by points: 10 = all bins correct, 5 = one bin wrong, 0 = two or more.${a.bucket === "week" ? " Weeks start on Monday." : ""}`}
            layout="stacked"
            normalize
            columns={a.quality.map((q) => ({ key: q.key, label: bucketLabel(q.key, a.bucket), axisLabel: bucketLabel(q.key, "day"), values: [q.poor, q.partial, q.clean] }))}
            series={[
              { name: "0 points", color: CHART_COLORS.ordinal[0] },
              { name: "5 points", color: CHART_COLORS.ordinal[1] },
              { name: "10 points", color: CHART_COLORS.ordinal[2] },
            ]}
            emptyText="No verified collections in this period yet."
          />
        </section>

        <section className="card" aria-label="Points earned and spent">
          <ColumnChart
            title={`Points earned and spent per ${per}`}
            description="Earned on the day of collection; spent on the day a reward was picked up."
            columns={a.points.map((p) => ({ key: p.key, label: bucketLabel(p.key, a.bucket), axisLabel: bucketLabel(p.key, "day"), values: [p.earned, p.spent] }))}
            series={[
              { name: "Earned", color: CHART_COLORS.primary },
              { name: "Spent", color: CHART_COLORS.secondary },
            ]}
            unit=" pts"
            emptyText="No points earned or spent in this period yet."
          />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card" aria-label="Puroks">
          <BarList
            title="Households reached, by purok"
            description="Share of each purok’s active households collected at least once in this period."
            percent
            rows={a.puroks.map((p) => ({
              label: p.purok,
              value: p.households ? p.reached / p.households : 0,
              note: `${p.reached} of ${p.households} · ${p.verified ? `${Math.round((p.clean / p.verified) * 100)}% sorted correctly` : "no verified collections"} · ${p.signedUp} in the app`,
            }))}
            emptyText="No active households yet."
          />
        </section>

        <section className="card" aria-label="Collectors">
          <BarList
            title="Collections by collector"
            description="Households recorded in this period, and how many days each collector worked."
            rows={a.collectors.map((c) => ({ label: c.name, value: c.collections, note: `${c.days} ${c.days === 1 ? "day" : "days"}` }))}
            emptyText="No collections in this period yet."
          />
        </section>
      </div>
    </div>
  );
}
