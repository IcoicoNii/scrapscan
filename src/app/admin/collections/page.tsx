import type { Metadata } from "next";
import Link from "next/link";
import type { CollectionStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { manilaDateString } from "@/lib/dates";
import { formatDateTime, formatPoints } from "@/lib/format";
import { BinResultLabel } from "@/components/bin-chips";
import { collectionStatusLabel } from "@/components/collection-status";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Collections" };

type Search = { day?: string; collector?: string; status?: string };
const STATUSES: CollectionStatus[] = ["VERIFIED", "FLAGGED", "REJECTED"];

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("collection:read:all");
  const sp = await searchParams;
  // Days are Manila dates, stored as UTC midnight of that date.
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : manilaDateString(new Date());
  const status = STATUSES.find((s) => s === sp.status);
  const where: Prisma.CollectionWhereInput = {
    collectionDay: new Date(`${day}T00:00:00Z`),
    ...(sp.collector ? { collectorId: sp.collector } : {}),
    ...(status ? { status } : {}),
  };

  const [collectors, rows] = await Promise.all([
    db.user.findMany({ where: { role: "COLLECTOR" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.collection.findMany({
      where,
      orderBy: { collectedAt: "asc" },
      take: 500,
      include: { household: { select: { code: true, name: true, purok: true } }, collector: { select: { name: true } } },
    }),
  ]);
  const counted = rows.filter((r) => r.status === "VERIFIED");
  const points = counted.reduce((s, r) => s + r.score, 0);
  const clean = counted.filter((r) => r.score === 10).length;
  const activeHouseholds = await db.household.count({ where: { status: "ACTIVE" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Collections" description="Every recorded collection for one day. Open a household to correct one." />

      <form className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div>
          <label htmlFor="day" className="mb-1 block text-sm font-semibold">Day</label>
          <input id="day" name="day" type="date" defaultValue={day} className="field-box" />
        </div>
        <div>
          <label htmlFor="collector" className="mb-1 block text-sm font-semibold">Collector</label>
          <select id="collector" name="collector" defaultValue={sp.collector ?? ""} className="field-box">
            <option value="">All collectors</option>
            {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-semibold">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="field-box">
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{collectionStatusLabel(s)}</option>)}
          </select>
        </div>
        <button className="btn btn-primary">Show</button>
      </form>

      <ul className="grid gap-4 sm:grid-cols-3">
        <li><StatCard label="Households collected" value={`${rows.length} of ${activeHouseholds}`} icon="houses" /></li>
        <li><StatCard label="Sorted correctly (10 pts)" value={rows.length ? `${Math.round((clean / Math.max(counted.length, 1)) * 100)}%` : "–"} note={`${clean} of ${counted.length} counted`} icon="check" /></li>
        <li><StatCard label="Points earned" value={formatPoints(points)} icon="leaf" /></li>
      </ul>

      {rows.length === 0 ? (
        <EmptyState icon="list" title="No collections that day" body="Pick another day or collector." />
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {rows.map((c) => (
              <li key={c.id} className="card space-y-2">
                <p className="flex items-baseline justify-between gap-3">
                  <Link href={`/admin/households/${c.household.code}`} className="font-extrabold text-forest underline-offset-4 hover:underline">
                    {c.household.code}
                  </Link>
                  <span className={`text-sm font-bold ${c.status === "VERIFIED" ? "text-forest" : "text-danger"}`}>
                    {collectionStatusLabel(c.status)} · {c.score} pts
                  </span>
                </p>
                <p className="text-sm text-slate-green">
                  {c.household.name} · {formatDateTime(c.collectedAt)} · {c.collector.name}
                </p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <li>Bio: <BinResultLabel result={c.biodegradable} /></li>
                  <li>Recyclable: <BinResultLabel result={c.recyclable} /></li>
                  <li>Residual: <BinResultLabel result={c.residual} /></li>
                </ul>
              </li>
            ))}
          </ul>
          <div className="hidden table-wrap md:block">
            <table className="data-table text-sm">
              <caption className="sr-only">Collections on {day}</caption>
              <thead>
                <tr>
                  {["Household", "Time", "Collector", "Biodegradable", "Recyclable", "Residual", "Status", "Points"].map((h) => (
                    <th key={h} scope="col" className={`px-4 py-3 ${h === "Points" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <th scope="row" className="px-4 py-3">
                      <Link href={`/admin/households/${c.household.code}`} className="font-bold text-forest underline-offset-4 hover:underline">{c.household.code}</Link>
                      <span className="block font-normal text-slate-green">{c.household.name}</span>
                    </th>
                    <td className="whitespace-nowrap px-4 py-3">{new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: "Asia/Manila" }).format(c.collectedAt)}</td>
                    <td className="px-4 py-3">{c.collector.name}</td>
                    <td className="px-4 py-3"><BinResultLabel result={c.biodegradable} /></td>
                    <td className="px-4 py-3"><BinResultLabel result={c.recyclable} /></td>
                    <td className="px-4 py-3"><BinResultLabel result={c.residual} /></td>
                    <td className={`px-4 py-3 font-semibold ${c.status === "VERIFIED" ? "" : "text-danger"}`}>{collectionStatusLabel(c.status)}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{c.score}</td>
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
