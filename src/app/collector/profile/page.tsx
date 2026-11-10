import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { DetailList, Notice, PageHeader, SectionCard } from "@/components/ui";

export const metadata: Metadata = { title: "Profile" };

export default async function CollectorProfile() {
  const user = await requirePagePermission("collection:read:own");
  const account = await db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true } });
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />
      <SectionCard id="account" title="Account" className="lg:max-w-2xl">
        <DetailList
          items={[
            { label: "Name", value: account?.name },
            { label: "Email", value: account?.email ?? "—" },
            { label: "Mobile", value: account?.phone ?? "—" },
            { label: "Role", value: "Waste collector" },
          ]}
        />
      </SectionCard>
      <div className="lg:max-w-2xl">
        <Notice>To change your account details, ask your barangay admin.</Notice>
      </div>
    </div>
  );
}
