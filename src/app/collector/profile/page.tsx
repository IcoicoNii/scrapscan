import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { DetailList, Notice, PageHeader, SectionCard } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Profile" };

export default async function CollectorProfile() {
  const user = await requirePagePermission("collection:read:own");
  const { t } = await getI18n();
  const account = await db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true } });
  return (
    <div className="space-y-6">
      <PageHeader title={t.common.profile} />
      <SectionCard id="account" title={t.citizen.account} className="lg:max-w-2xl">
        <DetailList
          items={[
            { label: t.common.name, value: account?.name },
            { label: t.common.email, value: account?.email ?? t.common.none },
            { label: t.common.mobile, value: account?.phone ?? t.common.none },
            { label: t.common.role, value: t.collector.roleValue },
          ]}
        />
      </SectionCard>
      <div className="lg:max-w-2xl">
        <Notice>{t.collector.askAdmin}</Notice>
      </div>
    </div>
  );
}
