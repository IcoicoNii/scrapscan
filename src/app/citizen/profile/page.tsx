import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatClaimCode } from "@/lib/codes";
import { MAX_MEMBERS } from "@/lib/households";
import { DetailList, Notice, PageHeader, SectionCard } from "@/components/ui";
import { HouseholdStatusNotice } from "@/components/household-status";
import { RegenerateOwnCode } from "./regenerate-code";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requirePagePermission("household:read:own");
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
      <PageHeader title="Profile" />
      {household && <HouseholdStatusNotice status={household.status} statusNote={household.statusNote} />}
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
        {household && household.status !== "INACTIVE" && (
          <SectionCard id="family" title="Sign-up code for your family">
            <p className="text-3xl font-extrabold tracking-widest text-forest">{formatClaimCode(household.claimCode)}</p>
            <p className="mt-2 text-sm text-slate-green">
              Family members choose “I have a sign-up code” when they sign up and enter this code, so they see the same points.
              Up to {MAX_MEMBERS} accounts. Only share it with your household.
            </p>
            <p className="mt-4 text-sm font-semibold">
              In this household ({household.members.length} of {MAX_MEMBERS})
            </p>
            <ul className="mt-1 text-sm">
              {household.members.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.id === user.id && " (you)"}
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <RegenerateOwnCode />
            </div>
          </SectionCard>
        )}
      </div>
      <Notice>To change your account or household details, ask your barangay admin.</Notice>
    </div>
  );
}
