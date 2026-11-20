import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatClaimCode } from "@/lib/codes";
import { formatDate, formatDateTime, formatPoints } from "@/lib/format";
import { normalizeHouseholdCode } from "@/lib/collection-input";
import { householdBalance } from "@/lib/admin-households";
import { MAX_MEMBERS, possibleDuplicates } from "@/lib/households";
import { qrSvg } from "@/lib/qr";
import { BinResultLabel } from "@/components/bin-chips";
import { collectionStatusLabel } from "@/lib/collection-status";
import { Icon } from "@/components/icons";
import { Notice, PageHeader, SectionCard, StatCard } from "@/components/ui";
import {
  EditDetailsForm,
  ExcludeCollectionForm,
  RegenerateCodeForm,
  RegistrationDecisionForm,
  ReplaceQrForm,
  StatusForm,
} from "./household-forms";

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: decodeURIComponent((await params).code).toUpperCase() };
}

export default async function HouseholdPage({ params }: Params) {
  await requirePagePermission("household:update");
  const code = normalizeHouseholdCode(decodeURIComponent((await params).code));
  const h = await db.household.findUnique({
    where: { code },
    include: {
      members: { select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      qrCodes: { orderBy: { createdAt: "desc" } },
      collections: { orderBy: { collectedAt: "desc" }, take: 20, include: { collector: { select: { name: true } } } },
    },
  });
  if (!h) notFound();
  const [balance, collectionCount] = await Promise.all([householdBalance(h.id), db.collection.count({ where: { householdId: h.id } })]);
  const activeQr = h.qrCodes.find((q) => q.status === "ACTIVE");
  const svg = activeQr ? await qrSvg(activeQr.token) : null;
  const revokedCount = h.qrCodes.length - (activeQr ? 1 : 0);
  const active = h.status === "ACTIVE";
  const pending = h.status === "PENDING";
  const duplicates = pending ? await possibleDuplicates(h) : [];

  return (
    <div className="space-y-6">
      <Link href="/admin/households" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline">
        <Icon name="arrow-left" className="h-5 w-5" />
        Households
      </Link>
      <PageHeader
        eyebrow={h.code}
        title={h.name}
        description={`${h.purok} · ${h.address}`}
        actions={
          activeQr && active && (
            <Link href={`/admin/households/print?codes=${h.code}`} className="btn btn-outline btn-sm">
              <Icon name="printer" className="h-5 w-5" />
              Print sticker
            </Link>
          )
        }
      />
      {h.selfRegistered && (
        <RegistrationDecisionForm householdId={h.id} pending={pending}>
          <div>
            <h2 id="approval" className="text-lg font-bold">Waiting for your approval</h2>
            <p className="mt-1 text-sm text-slate-green">
              Registered by {h.members[0]?.name ?? "a resident"} on {formatDateTime(h.createdAt)}. Collectors can’t record it until you
              approve. Check the address is in the barangay and the household isn’t already registered.
            </p>
          </div>
          {duplicates.length > 0 ? (
            <div className="rounded-2xl border border-danger/20 bg-danger-soft/60 p-3 text-sm">
              <p className="font-semibold text-danger">Possibly already registered:</p>
              <ul className="mt-1 space-y-1">
                {duplicates.map((d) => (
                  <li key={d.code}>
                    <Link href={`/admin/households/${d.code}`} className="font-semibold text-forest underline">{d.code}</Link> · {d.name} · {d.address}
                    {d.status !== "ACTIVE" && ` (${d.status === "PENDING" ? "also waiting" : "turned off"})`}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-green">No other household in {h.purok} has the same name or address.</p>
          )}
        </RegistrationDecisionForm>
      )}
      {h.status === "INACTIVE" && h.statusNote && <Notice tone="warn">Not approved: “{h.statusNote}”</Notice>}
      {h.status === "INACTIVE" && !h.statusNote && (
        <Notice tone="warn">This household is turned off. Collectors can’t record it and its sign-up code doesn’t work.</Notice>
      )}

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Points balance" value={formatPoints(balance)} icon="leaf" />
        <StatCard label="Collections" value={formatPoints(collectionCount)} icon="check" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <SectionCard id="details" title="Details">
          <EditDetailsForm householdId={h.id} name={h.name} address={h.address} purok={h.purok} />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard id="qr" title="QR code">
            {svg ? (
              <div className="flex items-center gap-4">
                <div
                  role="img"
                  aria-label={`Current QR code for ${h.code}`}
                  className="h-28 w-28 shrink-0 rounded-xl bg-white p-1 ring-1 ring-line [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                <p className="text-sm text-slate-green">
                  Issued {formatDate(activeQr!.createdAt)}.
                  {revokedCount > 0 && ` ${revokedCount} older ${revokedCount === 1 ? "code was" : "codes were"} replaced and no longer work.`}
                </p>
              </div>
            ) : (
              <p className="text-sm font-semibold text-danger">No active QR code. Issue a new one below.</p>
            )}
            <div className="mt-4">
              <ReplaceQrForm householdId={h.id} />
            </div>
          </SectionCard>

          <SectionCard id="signup" title={`App accounts (${h.members.length} of ${MAX_MEMBERS})`}>
            {h.members.length > 0 ? (
              <ul className="space-y-1">
                {h.members.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/accounts/${m.id}`} className="font-semibold text-forest hover:underline">
                      {m.name}
                    </Link>{" "}
                    <span className="text-sm text-slate-green">
                      {m.email ?? m.phone}
                      {m.status !== "ACTIVE" && " · turned off"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-green">No one has signed up yet.</p>
            )}
            <p className="mt-4">
              Sign-up code:{" "}
              <span className="whitespace-nowrap text-lg font-extrabold tracking-widest text-forest">{formatClaimCode(h.claimCode)}</span>
            </p>
            <p className="text-sm text-slate-green">Family members enter it when they sign up to join this household.</p>
            <div className="mt-2">
              <RegenerateCodeForm householdId={h.id} />
            </div>
          </SectionCard>

          {!pending && (
            <SectionCard id="status" title="Status">
              <StatusForm householdId={h.id} active={active} />
            </SectionCard>
          )}
        </div>
      </div>

      <SectionCard id="collections" title="Recent collections">
        {h.collections.length === 0 ? (
          <p className="text-slate-green">No collections yet.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {h.collections.map((c) => (
              <li key={c.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">{formatDateTime(c.collectedAt)}</span>
                  <span className={`text-sm font-bold ${c.status === "VERIFIED" ? "text-forest" : "text-danger"}`}>
                    {collectionStatusLabel(c.status)} · {c.status === "VERIFIED" ? `+${c.score}` : c.score} pts
                  </span>
                </p>
                <p className="text-sm text-slate-green">By {c.collector.name}</p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <li>Bio: <BinResultLabel result={c.biodegradable} /></li>
                  <li>Recyclable: <BinResultLabel result={c.recyclable} /></li>
                  <li>Residual: <BinResultLabel result={c.residual} /></li>
                </ul>
                {c.status !== "FLAGGED" && <ExcludeCollectionForm collectionId={c.id} score={c.score} counts={c.status === "VERIFIED"} />}
                {c.status === "FLAGGED" && (
                  <Link href="/admin/reviews" className="text-sm font-semibold text-forest underline">Decide it on the Reviews page</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
