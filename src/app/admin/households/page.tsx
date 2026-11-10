import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatClaimCode } from "@/lib/codes";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Households" };

export default async function HouseholdsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePagePermission("household:read:all");
  const { q } = await searchParams;
  const term = q?.trim();

  const rows = await db.household.findMany({
    where: term
      ? {
          OR: [
            { code: { contains: term, mode: "insensitive" } },
            { name: { contains: term, mode: "insensitive" } },
            { purok: { contains: term, mode: "insensitive" } },
          ],
        }
      : undefined,
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
          <Link href="/admin/households/new" className="btn btn-primary btn-sm">
            <Icon name="plus" className="h-5 w-5" />
            Add household
          </Link>
        }
      />

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
              <li key={h.id} className="card space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-extrabold text-forest">{h.code}</p>
                  <QrStatus active={h.qrCodes.length > 0} />
                </div>
                <p className="font-semibold">{h.name}</p>
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
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-bold">{h.code}</th>
                    <td className="px-4 py-3">{h.name}</td>
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

function SignUp({ claimedAt, claimCode }: { claimedAt: Date | null; claimCode: string }) {
  if (claimedAt) return <span className="font-semibold text-forest">Signed up</span>;
  return (
    <>
      Code: <span className="whitespace-nowrap font-bold tracking-wider">{formatClaimCode(claimCode)}</span>
    </>
  );
}
