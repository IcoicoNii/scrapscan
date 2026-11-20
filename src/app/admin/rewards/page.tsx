import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDateTime, formatPoints } from "@/lib/format";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { RedemptionDecision, RewardForm } from "./reward-forms";
import { RewardCatalogue } from "./reward-catalogue";

export const metadata: Metadata = { title: "Rewards" };

export default async function AdminRewardsPage() {
  await requirePagePermission("redemption:approve");
  const [open, recent, rewards] = await Promise.all([
    db.redemption.findMany({
      where: { status: { in: ["REQUESTED", "APPROVED"] } },
      orderBy: { requestedAt: "asc" },
      include: { reward: { select: { name: true } }, household: { select: { code: true, name: true } } },
    }),
    db.redemption.findMany({
      where: { status: { in: ["CLAIMED", "REJECTED", "CANCELLED"] } },
      orderBy: { decidedAt: "desc" },
      take: 10,
      include: { reward: { select: { name: true } }, household: { select: { code: true } }, decidedBy: { select: { name: true } } },
    }),
    db.reward.findMany({ orderBy: [{ active: "desc" }, { pointsCost: "asc" }] }),
  ]);
  const waiting = open.filter((r) => r.status === "REQUESTED");
  const ready = open.filter((r) => r.status === "APPROVED");
  const DONE = { CLAIMED: "Picked up", REJECTED: "Not approved", CANCELLED: "Cancelled by resident" } as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rewards"
        description={`${waiting.length} waiting for approval · ${ready.length} ready to pick up. Points are set aside the moment a resident requests.`}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {(
          [
            ["waiting", "Waiting for approval", waiting, "No requests waiting."],
            ["ready", "Ready to pick up", ready, "Nothing waiting to be picked up."],
          ] as const
        ).map(([id, title, list, empty]) => (
          <SectionCard key={id} id={id} title={`${title} (${list.length})`}>
            {list.length === 0 ? (
              <p className="text-slate-green">{empty}</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {list.map((r) => (
                  <li key={r.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-bold">
                        {r.reward.name} · {formatPoints(r.pointsHeld)} pts
                      </p>
                      <p className="text-sm text-slate-green">
                        {r.household.code} · {r.household.name} · requested {formatDateTime(r.requestedAt)}
                      </p>
                    </div>
                    <RedemptionDecision redemptionId={r.id} status={r.status as "REQUESTED" | "APPROVED"} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-start">
        <SectionCard id="catalogue" title="Reward catalogue">
          {rewards.length === 0 ? (
            <EmptyState icon="gift" title="No rewards yet" body="Add the first one so residents have something to work toward." />
          ) : (
            <RewardCatalogue rewards={rewards} />
          )}
        </SectionCard>
        <SectionCard id="add-reward" title="Add a reward">
          <RewardForm />
        </SectionCard>
      </div>

      {recent.length > 0 && (
        <SectionCard id="recent" title="Recently finished">
          <ul className="divide-y divide-line-soft text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5">
                <span className="font-semibold">
                  {r.household.code} · {r.reward.name}
                </span>
                <span className="text-slate-green">
                  {DONE[r.status as keyof typeof DONE]}
                  {r.decidedBy && ` by ${r.decidedBy.name}`}
                  {r.decidedAt && `, ${formatDateTime(r.decidedAt)}`}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
