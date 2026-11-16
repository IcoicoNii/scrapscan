import type { Metadata } from "next";
import type { HouseholdStatus } from "@prisma/client";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatClaimCode } from "@/lib/codes";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Households" };

const TABS = [
  ["ACTIVE", "Active"],
  ["PENDING", "Waiting for approval"],
  ["INACTIVE", "Turned off"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function HouseholdsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requirePagePermission("household:read:all");
  const { q, status: rawStatus } = await searchParams;
  const term = q?.trim();
  const status: Tab = TABS.find(([s]) => s === rawStatus)?.[0] ?? "ACTIVE";
  const counts = await db.household.groupBy({ by: ["status"], _count: true });
  const countOf = (s: Tab) => counts.find((c) => c.status === s)?._count ?? 0;

  const rows = await db.household.findMany({
    // A search looks across every status; otherwise show the chosen tab.
    where: term
      ? {
          OR: [
            { code: { contains: term, mode: "insensitive" } },
            { name: { contains: term, mode: "insensitive" } },
            { purok: { contains: term, mode: "insensitive" } },
          ],
        }
      : { status },
    orderBy: { code: "asc" },
    take: 200,
    include: { qrCodes: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Households"
        description={
          term
            ? `${rows.length} ${rows.length === 1 ? "match" : "matches"} for “${term}”`
            : `${rows.length}${rows.length === 200 ? "+" : ""} registered`
        }
        actions={
          <>
          <Link href="/admin/households/print" className="btn btn-outline btn-sm">
            <Icon name="printer" className="h-5 w-5" />
            Print QR stickers
          </Link>
          <Link href="/admin/households/new" className="btn btn-primary btn-sm">
            <Icon name="plus" className="h-5 w-5" />
            Add household
          </Link>
          </>
        }
      />

      {!term && (
        <nav aria-label="Household status" className="flex gap-2 overflow-x-auto">
          {TABS.map(([s, label]) => (
            <Link
              key={s}
              href={`/admin/households?status=${s}`}
              aria-current={s === status ? "page" : undefined}
              className={`btn btn-sm shrink-0 ${s === status ? "btn-primary" : "btn-secondary"}`}
            >
              {label} ({countOf(s)})
            </Link>
          ))}
        </nav>
      )}

      <form role="search" className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <label htmlFor="q" className="sr-only">
            Search by code, name or purok
          </label>
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-green" />
          <input id="q" name="q" type="search" defaultValue={term} placeholder="Search by code, name or purok" className="field-box pl-11" />
        </div>
        <button className="btn btn-primary">Search</button>
        {term && (
          <Link href="/admin/households" className="btn btn-ghost">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon="houses"
          title={term ? `No households match “${term}”` : "No households yet"}
          body={term ? "Try a household number, a family name or a purok." : "Add the first one to get its QR code and sign-up code."}
          action={
            !term && (
              <Link href="/admin/households/new" className="btn btn-primary">
                Add household
              </Link>
            )
          }
        />
      ) : (
        <>
          {/* Phones: cards. md+: a table. */}
          <ul className="space-y-3 md:hidden">
            {rows.map((h) => (
              <li key={h.id} className="card card-link relative space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={`/admin/households/${h.code}`} className="font-extrabold text-forest after:absolute after:inset-0 after:rounded-[inherit]">
                    {h.code}
                  </Link>
                  <QrStatus active={h.qrCodes.length > 0} />
                </div>
                <p className="font-semibold">
                  {h.name}
                  <StatusBadge status={h.status} />
                </p>
                <p className="text-sm text-slate-green">{h.purok}</p>
                <p className="text-sm">
                  <SignUp claimedAt={h.claimedAt} claimCode={h.claimCode} />
                </p>
              </li>
            ))}
          </ul>

          <div className="hidden table-wrap md:block">
            <table className="data-table text-sm">
              <caption className="sr-only">Households in the barangay</caption>
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Household</th>
                  <th scope="col" className="px-4 py-3">Purok</th>
                  <th scope="col" className="px-4 py-3">QR</th>
                  <th scope="col" className="px-4 py-3">Sign-up</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id}>
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-bold">
                      <Link href={`/admin/households/${h.code}`} className="text-forest underline-offset-4 hover:underline">{h.code}</Link>
                    </th>
                    <td className="px-4 py-3">
                      {h.name}
                      <StatusBadge status={h.status} />
                    </td>
                    <td className="px-4 py-3">{h.purok}</td>
                    <td className="px-4 py-3"><QrStatus active={h.qrCodes.length > 0} /></td>
                    <td className="px-4 py-3"><SignUp claimedAt={h.claimedAt} claimCode={h.claimCode} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function QrStatus({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${
        active ? "bg-mint text-forest ring-forest/15" : "bg-danger-soft text-danger ring-danger/20"
      }`}
    >
      <Icon name={active ? "check" : "warn"} className="h-3.5 w-3.5" />
      {active ? "QR active" : "QR revoked"}
    </span>
  );
}

function StatusBadge({ status }: { status: HouseholdStatus }) {
  if (status === "ACTIVE") return null;
  return status === "PENDING" ? (
    <span className="ml-2 whitespace-nowrap rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-khaki ring-1 ring-inset ring-moss/25">
      Waiting for approval
    </span>
  ) : (
    <span className="ml-2 whitespace-nowrap text-xs font-bold text-danger">Turned off</span>
  );
}

function SignUp({ claimedAt, claimCode }: { claimedAt: Date | null; claimCode: string }) {
  if (claimedAt) return <span className="font-semibold text-forest">Signed up</span>;
  return (
    <>
      Code: <span className="whitespace-nowrap font-bold tracking-wider">{formatClaimCode(claimCode)}</span>
    </>
  );
}
