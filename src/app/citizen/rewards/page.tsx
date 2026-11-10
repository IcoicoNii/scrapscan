import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatPoints } from "@/lib/format";
import { Icon } from "@/components/icons";
import { EmptyState, Notice, PageHeader, ProgressBar, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const user = await requirePagePermission("reward:read");
  const [rewards, points] = await Promise.all([
    db.reward.findMany({ where: { active: true }, orderBy: { pointsCost: "asc" } }),
    user.householdId
      ? db.pointsLedger.aggregate({ where: { householdId: user.householdId }, _sum: { points: true } })
      : null,
  ]);
  const balance = points?._sum.points ?? 0;
  const affordable = rewards.filter((r) => balance >= r.pointsCost).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Rewards" description="Trade the points your household earns for rewards from the barangay." />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard tone="forest" label="Your points" value={`${formatPoints(balance)} pts`} icon="leaf" />
        <StatCard
          label="Rewards within reach"
          value={`${affordable} of ${rewards.length}`}
          note={affordable ? "You have enough points for these now." : "Keep sorting to unlock your first reward."}
          icon="gift"
        />
      </div>

      <Notice>Requesting rewards in the app isn’t available yet. For now, ask your barangay office about claiming one.</Notice>

      {rewards.length === 0 ? (
        <EmptyState icon="gift" title="No rewards listed yet" body="Your barangay admin will add them." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => {
            const enough = balance >= r.pointsCost;
            return (
              <li key={r.id} className="card card-link flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="icon-tile h-11 w-11">
                    <Icon name="gift" className="h-6 w-6" />
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                      enough ? "bg-lawn text-khaki" : "bg-line-soft text-slate-green ring-1 ring-inset ring-line"
                    }`}
                  >
                    {enough && <Icon name="check" className="h-4 w-4" />}
                    {enough ? "You have enough" : `Need ${formatPoints(r.pointsCost - balance)} more`}
                  </span>
                </div>
                <p className="mt-4 text-lg font-bold">{r.name}</p>
                {r.description && <p className="mt-1 text-sm text-slate-green">{r.description}</p>}
                <div className="mt-auto space-y-2 pt-5">
                  <p className="text-2xl font-extrabold tracking-tight tabular-nums text-forest">{formatPoints(r.pointsCost)} pts</p>
                  <ProgressBar value={balance} max={r.pointsCost} label={`Progress toward ${r.name}`} />
                  {r.stock !== null && (
                    <p className="text-xs font-semibold text-slate-green">{r.stock > 0 ? `${r.stock} left` : "Out of stock"}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
