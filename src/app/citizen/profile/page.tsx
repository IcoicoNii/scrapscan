import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatClaimCode } from "@/lib/codes";
import { MAX_MEMBERS } from "@/lib/households";
import { DetailList, Notice, PageHeader, SectionCard } from "@/components/ui";
import { HouseholdStatusNotice } from "@/components/household-status";
import { RegenerateOwnCode } from "./regenerate-code";
import { getI18n } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/config";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requirePagePermission("household:read:own");
  const { t } = await getI18n();
  const c = t.citizen;
  const [account, household] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true } }),
    user.householdId
      ? db.household.findUnique({
          where: { id: user.householdId },
          select: {
            code: true, name: true, address: true, purok: true, status: true, statusNote: true, claimCode: true,
            members: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
          },
        })
      : null,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={c.profileTitle} />
      {household && <HouseholdStatusNotice status={household.status} statusNote={household.statusNote} />}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <SectionCard id="account" title={c.account}>
          <DetailList
            items={[
              { label: t.common.name, value: account?.name },
              { label: t.common.email, value: account?.email ?? t.common.none },
              { label: t.common.mobile, value: account?.phone ?? t.common.none },
            ]}
          />
        </SectionCard>
        <SectionCard id="household" title={c.household}>
          {household ? (
            <DetailList
              items={[
                { label: c.householdNo, value: household.code },
                { label: t.common.name, value: household.name },
                { label: c.address, value: household.address },
                { label: c.purok, value: household.purok },
              ]}
            />
          ) : (
            <p className="text-slate-green">{c.notLinked}</p>
          )}
        </SectionCard>
        {household && household.status !== "INACTIVE" && (
          <SectionCard id="family" title={c.familyTitle}>
            <p className="text-3xl font-extrabold tracking-widest text-forest">{formatClaimCode(household.claimCode)}</p>
            <p className="mt-2 text-sm text-slate-green">
              {format(c.familyBody, { max: MAX_MEMBERS })}
            </p>
            <p className="mt-4 text-sm font-semibold">
              {format(c.inHousehold, { n: household.members.length, max: MAX_MEMBERS })}
            </p>
            <ul className="mt-1 text-sm">
              {household.members.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.id === user.id && ` ${c.you}`}
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <RegenerateOwnCode />
            </div>
          </SectionCard>
        )}
      </div>
      <Notice>{c.askAdmin}</Notice>
    </div>
  );
}
