import type { Metadata } from "next";
import Image from "next/image";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDateTime, formatPoints } from "@/lib/format";
import { MAX_OPEN_REQUESTS } from "@/lib/redemptions";
import { Icon } from "@/components/icons";
import { EmptyState, Notice, PageHeader, ProgressBar, SectionCard, StatCard } from "@/components/ui";
import { CancelRequestButton, RequestRewardButton } from "./reward-buttons";
import { getI18n } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/config";

const TONE = {
  REQUESTED: "text-khaki",
  APPROVED: "text-forest",
  CLAIMED: "text-slate-green",
  REJECTED: "text-danger",
  CANCELLED: "text-slate-green",
} as const;

export const metadata: Metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const user = await requirePagePermission("reward:read");
  const { t, intl } = await getI18n();
  const c = t.citizen;
  const STATUS_LABEL = {
    REQUESTED: c.reqWaiting,
    APPROVED: c.reqApproved,
    CLAIMED: c.reqClaimed,
    REJECTED: c.reqRejected,
    CANCELLED: c.reqCancelled,
  } as const;
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
      <PageHeader title={c.rewardsTitle} description={c.rewardsIntro} />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          tone="forest"
          label={c.canSpend}
          value={`${formatPoints(balance, intl)} ${t.common.pts}`}
          note={setAside > 0 ? format(c.setAside, { n: formatPoints(setAside, intl) }) : undefined}
          icon="leaf"
        />
        <StatCard
          label={c.withinReach}
          value={format(c.withinReachValue, { n: affordable, total: rewards.length })}
          note={affordable ? c.enoughNow : c.keepSorting}
          icon="gift"
        />
      </div>

      {requests.length > 0 && (
        <SectionCard id="requests" title={c.yourRequests}>
          <ul className="divide-y divide-line-soft">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.reward.name} · {formatPoints(r.pointsHeld, intl)} {t.common.pts}
                  </p>
                  <p className={`text-sm font-semibold ${TONE[r.status]}`}>{STATUS_LABEL[r.status]}</p>
                  {r.status === "REJECTED" && r.note && <p className="text-sm">“{r.note}”</p>}
                  <p className="text-xs text-slate-green">{format(c.requested, { date: formatDateTime(r.requestedAt, intl) })}</p>
                </div>
                {r.status === "REQUESTED" && <CancelRequestButton redemptionId={r.id} />}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      {!canRequest && user.householdId && (
        <Notice>{format(c.openLimit, { n: open.length })}</Notice>
      )}

      {rewards.length === 0 ? (
        <EmptyState icon="gift" title={c.noRewards} body={c.noRewardsBody} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rewards.map((r) => {
            const enough = balance >= r.pointsCost;
            return (
              <li key={r.id} className="card flex h-full flex-col gap-5 sm:flex-row sm:items-stretch">
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-line-soft sm:aspect-auto sm:w-2/5 sm:min-h-56">
                  {r.imageUrl ? (
                    <Image src={r.imageUrl} alt={r.name} fill sizes="(min-width: 640px) 40vw, 100vw" className="object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-slate-green">
                      <Icon name="gift" className="h-12 w-12" />
                    </div>
                  )}
                  <span
                    className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${
                      enough ? "bg-lawn text-khaki" : "bg-white text-slate-green ring-1 ring-inset ring-line"
                    }`}
                  >
                    {enough && <Icon name="check" className="h-4 w-4" />}
                    {enough ? c.haveEnough : format(c.needMore, { n: formatPoints(r.pointsCost - balance, intl) })}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="line-clamp-2 text-lg font-bold leading-7">{r.name}</p>
                  {r.description && <p className="mt-1 line-clamp-3 text-sm text-slate-green">{r.description}</p>}
                  <div className="mt-auto space-y-2 pt-5">
                    <p className="text-2xl font-extrabold tracking-tight tabular-nums text-forest">{formatPoints(r.pointsCost, intl)} {t.common.pts}</p>
                    <ProgressBar value={balance} max={r.pointsCost} label={format(c.progressToward, { name: r.name })} />
                    {r.stock !== null && (
                      <p className="text-xs font-semibold text-slate-green">{r.stock > 0 ? format(c.left, { n: r.stock }) : c.outOfStock}</p>
                    )}
                    {enough && canRequest && (r.stock === null || r.stock > 0) && (
                      <RequestRewardButton rewardId={r.id} name={r.name} cost={r.pointsCost} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
