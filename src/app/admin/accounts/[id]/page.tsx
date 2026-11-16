import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { manilaDay } from "@/lib/dates";
import { Icon } from "@/components/icons";
import { DetailList, Notice, PageHeader, SectionCard } from "@/components/ui";
import { AccountStatusForm, LinkHouseholdForm, ResetPasswordForm } from "../account-forms";
import { ROLE_LABEL } from "../roles";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePagePermission("user:manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const u = await db.user.findUnique({ where: { id }, include: { household: { select: { code: true, name: true } } } });
  if (!u) notFound();
  const self = u.id === admin.id;
  const active = u.status === "ACTIVE";
  const [today, total, lastLog] = await Promise.all([
    u.role === "COLLECTOR" ? db.collection.count({ where: { collectorId: u.id, collectionDay: manilaDay(new Date()) } }) : null,
    u.role === "COLLECTOR" ? db.collection.count({ where: { collectorId: u.id } }) : null,
    db.auditLog.findFirst({ where: { targetType: "User", targetId: u.id }, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } }),
  ]);

  return (
    <div className="space-y-6">
      <Link href={`/admin/accounts?role=${u.role}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline">
        <Icon name="arrow-left" className="h-5 w-5" />
        Accounts
      </Link>
      <PageHeader eyebrow={ROLE_LABEL[u.role]} title={u.name} description={u.email ?? u.phone ?? undefined} />
      {!active && <Notice tone="warn">This account is turned off. It can’t log in or use the app.</Notice>}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <SectionCard id="about" title="About">
          <DetailList
            items={[
              { label: "Logs in with", value: u.email ?? u.phone },
              { label: "Role", value: ROLE_LABEL[u.role] },
              { label: "Created", value: formatDate(u.createdAt) },
              ...(u.household
                ? [{ label: "Household", value: <Link className="font-semibold text-forest hover:underline" href={`/admin/households/${u.household.code}`}>{u.household.code} · {u.household.name}</Link> }]
                : []),
              ...(total !== null ? [{ label: "Collections", value: `${total} in total, ${today} today` }] : []),
              { label: "Password", value: u.mustChangePassword ? "Temporary (they haven’t chosen their own yet)" : "Chosen by them" },
              ...(lastLog ? [{ label: "Last account change", value: `${lastLog.action.replace("account.", "").replace("_", " ")} by ${lastLog.actor.name}, ${formatDateTime(lastLog.createdAt)}` }] : []),
            ]}
          />
        </SectionCard>

        {self ? (
          <Notice>This is your account. Use Change password in the menu to change your own password.</Notice>
        ) : (
          <div className="space-y-6">
            {u.role === "CITIZEN" && (
              <SectionCard id="household" title="Household">
                <LinkHouseholdForm userId={u.id} current={u.household?.code ?? null} />
              </SectionCard>
            )}
            <SectionCard id="password" title="Password">
              <ResetPasswordForm userId={u.id} name={u.name} />
            </SectionCard>
            <SectionCard id="access" title={active ? "Turn off account" : "Turn on account"}>
              <AccountStatusForm userId={u.id} active={active} />
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
