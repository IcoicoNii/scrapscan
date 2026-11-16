import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDate, formatPoints } from "@/lib/format";
import { BinChips } from "@/components/bin-chips";
import { HouseholdStatusNotice } from "@/components/household-status";
import { CollectionPoints, CollectionStatusNote } from "@/components/collection-status";
import { Icon, type IconName } from "@/components/icons";
import { EmptyState, PageHeader, ProgressBar, SectionCard } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { format, plural } from "@/lib/i18n/config";

export const metadata: Metadata = { title: "Home" };

export default async function CitizenHome() {
  const user = await requirePagePermission("household:read:own");
  const householdId = user.householdId;
  const { t, intl } = await getI18n();
  const c = t.citizen;
  if (!householdId) {
    return <EmptyState icon="houses" title={c.noHousehold} body={c.noHouseholdBody} />;
  }
  const actions: { href: string; label: string; icon: IconName }[] = [
    { href: "/citizen/qr", label: c.myQr, icon: "qr" },
    { href: "/citizen/history", label: t.common.history, icon: "clock" },
    { href: "/citizen/rewards", label: t.common.rewards, icon: "gift" },
  ];

  // Scoped by the household on the signed-in account, never by anything in the URL.
  const [points, verified, latest, household] = await Promise.all([
    db.pointsLedger.aggregate({ where: { householdId }, _sum: { points: true } }),
    db.collection.count({ where: { householdId, status: "VERIFIED" } }),
    db.collection.findFirst({ where: { householdId }, orderBy: { collectedAt: "desc" } }),
    db.household.findUnique({ where: { id: householdId }, select: { code: true, name: true, status: true, statusNote: true } }),
  ]);
  const balance = points._sum.points ?? 0;
  const nextReward = await db.reward.findFirst({
    where: { active: true, pointsCost: { gt: balance } },
    orderBy: { pointsCost: "asc" },
    select: { name: true, pointsCost: true },
  });
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={c.goodDay}
        title={firstName}
        description={household ? `${household.name} · ${household.code}` : undefined}
      />
      {household && <HouseholdStatusNotice status={household.status} statusNote={household.statusNote} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section aria-labelledby="pts" className="surface-forest rounded-[1.75rem] p-6 shadow-lift lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <h2 id="pts" className="text-sm font-semibold text-mint">
                {c.availablePoints}
              </h2>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-lawn ring-1 ring-inset ring-white/15">
                <Icon name="leaf" className="h-6 w-6" />
              </span>
            </div>
            <p className="mt-1 text-5xl font-extrabold tracking-tight tabular-nums lg:text-6xl">
              {formatPoints(balance, intl)} <span className="text-xl font-semibold text-lawn">{t.common.pts}</span>
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium ring-1 ring-inset ring-white/15">
              <Icon name="check" className="h-4 w-4 text-lawn" />
              {plural(verified, c.verifiedOne, c.verifiedOther)}
            </p>
          </section>

          <nav aria-label={c.shortcuts}>
            <ul className="grid grid-cols-3 gap-3">
              {actions.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="card card-link flex min-h-28 flex-col items-center justify-center gap-2.5 p-3 text-center text-sm font-semibold text-forest sm:text-base"
                  >
                    <span className="icon-tile h-12 w-12">
                      <Icon name={a.icon} className="h-6 w-6" />
                    </span>
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="space-y-6">
          <SectionCard
            id="latest"
            title={c.latest}
            action={
              latest && (
                <Link href="/citizen/history" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest hover:underline">
                  {c.allHistory} <Icon name="chevron-right" className="h-4 w-4" />
                </Link>
              )
            }
          >
            {latest ? (
              <div className="space-y-3">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-slate-green">{formatDate(latest.collectedAt, intl)}</span>
                  <CollectionPoints status={latest.status} score={latest.score} size="lg" />
                </p>
                <BinChips bins={latest} />
                <CollectionStatusNote status={latest.status} />
              </div>
            ) : (
              <p className="text-slate-green">{c.noCollections}</p>
            )}
          </SectionCard>

          <SectionCard id="next" title={c.nextReward}>
            {nextReward ? (
              <div className="space-y-3">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{nextReward.name}</span>
                  <span className="shrink-0 font-extrabold tabular-nums text-forest">{formatPoints(nextReward.pointsCost, intl)} {t.common.pts}</span>
                </p>
                <ProgressBar value={balance} max={nextReward.pointsCost} label={format(c.progressToward, { name: nextReward.name })} />
                <p className="text-sm text-slate-green">{format(c.moreToGo, { n: formatPoints(nextReward.pointsCost - balance, intl) })}</p>
              </div>
            ) : (
              <p className="text-slate-green">
                {c.enoughForAll}{" "}
                <Link href="/citizen/rewards" className="font-semibold text-forest underline underline-offset-4">
                  {c.seeRewards}
                </Link>
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
