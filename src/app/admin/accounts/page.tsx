import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { ROLE_LABEL } from "./roles";

export const metadata: Metadata = { title: "Accounts" };

const ROLES = { COLLECTOR: "Collectors", ADMIN: "Admins", CITIZEN: "Residents" } as const;
type RoleKey = keyof typeof ROLES;

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string }> }) {
  await requirePagePermission("user:manage");
  const sp = await searchParams;
  const role: RoleKey = sp.role && sp.role in ROLES ? (sp.role as RoleKey) : "COLLECTOR";
  const q = sp.q?.trim();

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q.replace(/\D/g, "") || q } },
        ],
      }
    : { role };
  const [users, counts] = await Promise.all([
    db.user.findMany({ where, orderBy: [{ status: "asc" }, { name: "asc" }], take: 200, include: { household: { select: { code: true } } } }),
    db.user.groupBy({ by: ["role"], _count: true }),
  ]);
  const countOf = (r: RoleKey) => counts.find((c) => c.role === r)?._count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Who can log in. Residents sign up themselves with their household’s code; you add collectors and admins."
        actions={
          <Link href="/admin/accounts/new" className="btn btn-primary btn-sm">
            <Icon name="plus" className="h-5 w-5" />
            Add collector or admin
          </Link>
        }
      />

      <form role="search" className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <label htmlFor="q" className="sr-only">Search by name, email or number</label>
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-green" />
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name, email or number" className="field-box pl-11" />
        </div>
        <button className="btn btn-primary">Search</button>
        {q && <Link href="/admin/accounts" className="btn btn-ghost">Clear</Link>}
      </form>

      {!q && (
        <nav aria-label="Account types" className="flex gap-2 overflow-x-auto">
          {(Object.keys(ROLES) as RoleKey[]).map((r) => (
            <Link
              key={r}
              href={`/admin/accounts?role=${r}`}
              aria-current={r === role ? "page" : undefined}
              className={`btn btn-sm shrink-0 ${r === role ? "btn-primary" : "btn-secondary"}`}
            >
              {ROLES[r]} ({countOf(r)})
            </Link>
          ))}
        </nav>
      )}

      {users.length === 0 ? (
        <EmptyState icon="users" title={q ? `No accounts match “${q}”` : `No ${ROLES[role].toLowerCase()} yet`} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {users.map((u) => (
            <li key={u.id} className="card card-link relative">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/accounts/${u.id}`} className="font-bold after:absolute after:inset-0 after:rounded-[inherit]">
                    {u.name}
                  </Link>
                  <p className="truncate text-sm text-slate-green">{u.email ?? u.phone}</p>
                  <p className="mt-1 text-sm text-slate-green">
                    {ROLE_LABEL[u.role]}
                    {u.household && ` · ${u.household.code}`} · since {formatDate(u.createdAt)}
                  </p>
                </div>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {u.status !== "ACTIVE" && <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-bold text-danger">Turned off</span>}
                  {u.mustChangePassword && u.status === "ACTIVE" && (
                    <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-bold text-khaki">Temporary password</span>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
