import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDateTime, formatPoints } from "@/lib/format";
import { MAX_OPEN_REQUESTS } from "@/lib/redemptions";
import { Icon } from "@/components/icons";
import { EmptyState, Notice, PageHeader, ProgressBar, SectionCard, StatCard } from "@/components/ui";
import { CancelRequestButton, RequestRewardButton } from "./reward-buttons";

const REQUEST_STATUS = {
  REQUESTED: { label: "Waiting for the barangay office", tone: "text-khaki" },
  APPROVED: { label: "Ready to pick up at the barangay office", tone: "text-forest" },
  CLAIMED: { label: "Picked up", tone: "text-slate-green" },
  REJECTED: { label: "Not approved. Your points were returned.", tone: "text-danger" },
  CANCELLED: { label: "Cancelled. Your points were returned.", tone: "text-slate-green" },
} as const;

export const metadata: Metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const user = await requirePagePermission("reward:read");
  const [rewards, points, requests] = await Promise.all([
    db.reward.findMany({ where: { active: true }, orderBy: { pointsCost: "asc" } }),
    user.householdId
      ? db.pointsLedger.aggregate({ where: { householdId: user.householdId }, _sum: { points: true } })
      : null,
    user.householdId
      ? db.redemption.findMany({
          where: { householdId: user.householdId },
          orderBy: { requestedAt: "desc" },
          take: 20,
          include: { reward: { select: { name: true } } },
        })
      : [],
  ]);
  // The ledger already subtracts points set aside for open requests, so this is what's free to spend.
  const balance = points?._sum.points ?? 0;
  const affordable = rewards.filter((r) => balance >= r.pointsCost).length;
  const open = requests.filter((r) => r.status === "REQUESTED" || r.status === "APPROVED");
  const setAside = open.reduce((s, r) => s + r.pointsHeld, 0);
  const canRequest = Boolean(user.householdId) && open.length < MAX_OPEN_REQUESTS;

  return (
    <div className="space-y-6">
      <PageHeader title="Rewards" description="Trade the points your household earns for rewards from the barangay." />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          tone="forest"
          label="Points you can spend"
          value={`${formatPoints(balance)} pts`}
          note={setAside > 0 ? `${formatPoints(setAside)} more set aside for your requests` : undefined}
          icon="leaf"
        />
        <StatCard
          label="Rewards within reach"
          value={`${affordable} of ${rewards.length}`}
          note={affordable ? "You have enough points for these now." : "Keep sorting to unlock your first reward."}
          icon="gift"
        />
      </div>

      {requests.length > 0 && (
        <SectionCard id="requests" title="Your requests">
          <ul className="divide-y divide-line-soft">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.reward.name} · {formatPoints(r.pointsHeld)} pts
                  </p>
                  <p className={`text-sm font-semibold ${REQUEST_STATUS[r.status].tone}`}>{REQUEST_STATUS[r.status].label}</p>
                  {r.status === "REJECTED" && r.note && <p className="text-sm">“{r.note}”</p>}
                  <p className="text-xs text-slate-green">Requested {formatDateTime(r.requestedAt)}</p>
                </div>
                {r.status === "REQUESTED" && <CancelRequestButton redemptionId={r.id} />}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      {!canRequest && user.householdId && (
        <Notice>You have {open.length} open requests. Pick up or cancel one before requesting another.</Notice>
      )}

      {rewards.length === 0 ? (
        <EmptyState icon="gift" title="No rewards listed yet" body="Your barangay admin will add them." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => {
            const enough = balance >= r.pointsCost;
            return (
              <li key={r.id} className="card flex flex-col">
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
                  {enough && canRequest && (r.stock === null || r.stock > 0) && (
                    <RequestRewardButton rewardId={r.id} name={r.name} cost={r.pointsCost} />
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
