import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatPoints } from "@/lib/format";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader, ProgressBar, SectionCard, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverview() {
  await requirePagePermission("analytics:read");

  // Real numbers straight from the database. Zero is a valid value, not a placeholder.
  const [households, claimed, collectors, collections, issued] = await Promise.all([
    db.household.count({ where: { status: "ACTIVE" } }),
    db.household.count({ where: { status: "ACTIVE", claimedAt: { not: null } } }),
    db.user.count({ where: { role: "COLLECTOR", status: "ACTIVE" } }),
    db.collection.count({ where: { status: "VERIFIED" } }),
    // Awards on verified collections only: a flagged collection's points are on hold.
    db.pointsLedger.aggregate({ where: { type: "AWARD", collection: { status: "VERIFIED" } }, _sum: { points: true } }),
  ]);
  const signupPct = households ? Math.round((claimed / households) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="How the pilot is doing across the barangay."
        actions={
          <Link href="/admin/households/new" className="btn btn-primary btn-sm">
            <Icon name="plus" className="h-5 w-5" />
            Add household
          </Link>
        }
      />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li><StatCard label="Registered households" value={formatPoints(households)} note={`${claimed} signed up in the app`} icon="houses" /></li>
        <li><StatCard label="Active collectors" value={formatPoints(collectors)} icon="user" /></li>
        <li><StatCard label="Verified collections" value={formatPoints(collections)} icon="check" /></li>
        <li><StatCard label="Points issued" value={formatPoints(issued._sum.points ?? 0)} icon="leaf" /></li>
      </ul>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard id="signup" title="App sign-ups">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-slate-green">
              {claimed} of {households} households
            </span>
            <span className="text-3xl font-extrabold tracking-tight tabular-nums text-forest">{signupPct}%</span>
          </p>
          <div className="mt-3">
            <ProgressBar value={claimed} max={households} label="Households signed up in the app" />
          </div>
          <p className="mt-3 text-sm text-slate-green">
            Households that haven’t signed up still earn points. Give residents their household code so they can see them.
          </p>
        </SectionCard>

        <SectionCard id="quick" title="Quick actions">
          <ul className="space-y-2">
            <li>
              <Link href="/admin/households/new" className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-transparent px-3 font-semibold transition-colors hover:border-line hover:bg-mint/60">
                <span className="flex items-center gap-3"><Icon name="plus" className="h-5 w-5 text-forest" />Add a household</span>
                <Icon name="chevron-right" className="h-5 w-5" />
              </Link>
            </li>
            <li>
              <Link href="/admin/households" className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-transparent px-3 font-semibold transition-colors hover:border-line hover:bg-mint/60">
                <span className="flex items-center gap-3"><Icon name="houses" className="h-5 w-5 text-forest" />View households and codes</span>
                <Icon name="chevron-right" className="h-5 w-5" />
              </Link>
            </li>
          </ul>
        </SectionCard>
      </div>

      {collections === 0 && (
        <EmptyState
          icon="chart"
          title="No collections recorded yet"
          body="Charts and trends will appear here once collectors start submitting."
        />
      )}
    </div>
  );
}
