import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 50;

// Plain-language names for audit actions. Unknown actions fall back to their raw name.
const ACTIONS: Record<string, string> = {
  "household.create": "Added household",
  "household.register": "Resident registered a household",
  "household.join": "Resident joined a household",
  "household.approve": "Approved household registration",
  "household.reject": "Didn’t approve household registration",
  "household.code_reset": "Made a new sign-up code",
  "account.household_link": "Changed a resident’s household",
  "household.update": "Edited household details",
  "household.deactivate": "Turned off household",
  "household.activate": "Turned on household",
  "qr.replace": "Replaced QR code",
  "collection.flag": "Collection flagged (sent again with different details)",
  "collection.release": "Released flagged collection",
  "collection.reject": "Didn’t count flagged collection",
  "collection.exclude": "Stopped counting a collection",
  "account.create": "Added account",
  "account.password_reset": "Reset password",
  "account.password_change": "Changed own password",
  "account.deactivate": "Turned off account",
  "account.activate": "Turned on account",
  "reward.create": "Added reward",
  "reward.update": "Edited reward",
  "redemption.request": "Requested reward",
  "redemption.approve": "Approved reward request",
  "redemption.claim": "Reward picked up",
  "redemption.reject": "Didn’t approve reward request",
  "redemption.cancel": "Cancelled reward request",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; area?: string }> }) {
  await requirePagePermission("audit:read");
  const sp = await searchParams;
  const page = Math.max(1, Math.min(1000, Number.parseInt(sp.page ?? "1", 10) || 1));
  const area = ["household", "qr", "collection", "account", "reward", "redemption"].find((a) => a === sp.area);
  const where = area ? { action: { startsWith: `${area}.` } } : {};

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE,
    take: PAGE + 1,
    include: { actor: { select: { name: true, role: true } } },
  });
  const more = logs.length > PAGE;
  const shown = logs.slice(0, PAGE);

  // Resolve targets to something a person recognizes.
  const ids = (t: string) => shown.filter((l) => l.targetType === t).map((l) => l.targetId);
  const [households, collections, users] = await Promise.all([
    db.household.findMany({ where: { id: { in: ids("Household") } }, select: { id: true, code: true } }),
    db.collection.findMany({ where: { id: { in: ids("Collection") } }, select: { id: true, household: { select: { code: true } } } }),
    db.user.findMany({ where: { id: { in: ids("User") } }, select: { id: true, name: true } }),
  ]);
  const target = (t: string, id: string): { label: string; href?: string } => {
    if (t === "Household") {
      const h = households.find((x) => x.id === id);
      return h ? { label: h.code, href: `/admin/households/${h.code}` } : { label: "Household" };
    }
    if (t === "Collection") {
      const c = collections.find((x) => x.id === id);
      return c ? { label: `Collection for ${c.household.code}`, href: `/admin/households/${c.household.code}` } : { label: "Collection" };
    }
    if (t === "User") {
      const u = users.find((x) => x.id === id);
      return u ? { label: u.name, href: `/admin/accounts/${id}` } : { label: "Account" };
    }
    return { label: t };
  };
  const href = (p: number) => `/admin/audit?${new URLSearchParams({ ...(area && { area }), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Every change to households, points, rewards and accounts, who made it and why. Entries can’t be edited." />
      <nav aria-label="Filter" className="flex gap-2 overflow-x-auto">
        {[["", "Everything"], ["collection", "Collections"], ["household", "Households"], ["qr", "QR codes"], ["redemption", "Reward requests"], ["reward", "Rewards"], ["account", "Accounts"]].map(([a, label]) => (
          <Link
            key={a}
            href={a ? `/admin/audit?area=${a}` : "/admin/audit"}
            aria-current={(area ?? "") === a ? "page" : undefined}
            className={`btn btn-sm shrink-0 ${(area ?? "") === a ? "btn-primary" : "btn-secondary"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <EmptyState icon="clock" title="Nothing recorded yet" />
      ) : (
        <ol className="card divide-y divide-line-soft">
          {shown.map((l) => {
            const t = target(l.targetType, l.targetId);
            return (
              <li key={l.id} className="space-y-0.5 py-3 first:pt-0 last:pb-0">
                <p className="font-semibold">
                  {ACTIONS[l.action] ?? l.action}
                  {" · "}
                  {t.href ? <Link href={t.href} className="text-forest underline-offset-4 hover:underline">{t.label}</Link> : t.label}
                </p>
                <p className="text-sm text-slate-green">
                  {l.actor.name} · {formatDateTime(l.createdAt)}
                </p>
                {l.reason && <p className="text-sm">“{l.reason}”</p>}
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex justify-between gap-3">
        {page > 1 ? <Link href={href(page - 1)} className="btn btn-outline btn-sm">Newer</Link> : <span />}
        {more && <Link href={href(page + 1)} className="btn btn-outline btn-sm">Older</Link>}
      </div>
    </div>
  );
}
