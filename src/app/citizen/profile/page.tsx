import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { DetailList, Notice, PageHeader, SectionCard } from "@/components/ui";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requirePagePermission("household:read:own");
  const [account, household] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true } }),
    user.householdId
      ? db.household.findUnique({ where: { id: user.householdId }, select: { code: true, name: true, address: true, purok: true } })
      : null,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <SectionCard id="account" title="Account">
          <DetailList
            items={[
              { label: "Name", value: account?.name },
              { label: "Email", value: account?.email ?? "—" },
              { label: "Mobile", value: account?.phone ?? "—" },
            ]}
          />
        </SectionCard>
        <SectionCard id="household" title="Household">
          {household ? (
            <DetailList
              items={[
                { label: "Household no.", value: household.code },
                { label: "Name", value: household.name },
                { label: "Address", value: household.address },
                { label: "Purok", value: household.purok },
              ]}
            />
          ) : (
            <p className="text-slate-green">Your account isn’t linked to a household yet.</p>
          )}
        </SectionCard>
      </div>
      <Notice>To change your account or household details, ask your barangay admin.</Notice>
    </div>
  );
}
