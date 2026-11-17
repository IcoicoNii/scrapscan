import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatClaimCode } from "@/lib/codes";
import { qrSvg } from "@/lib/qr";
import { Icon } from "@/components/icons";
import { EmptyState, Notice, PageHeader } from "@/components/ui";
import { PrintButton } from "@/app/citizen/qr/print-button";

export const metadata: Metadata = { title: "Print QR stickers" };

type Search = { purok?: string; codes?: string; who?: string; names?: string; slips?: string };

// Printable QR stickers, 3 across on A4/Letter. A sticker carries only the opaque token and the household
// number. Names and sign-up codes are opt-in, because stickers go on bins outside the house.
export default async function PrintStickersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("household:read:all");
  const sp = await searchParams;
  const codes = sp.codes?.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean).slice(0, 500);
  const who = sp.who === "unclaimed" ? "unclaimed" : "all";
  const showNames = sp.names === "on";
  const showSlips = sp.slips === "on";

  const [puroks, households] = await Promise.all([
    db.household.findMany({ where: { status: "ACTIVE" }, distinct: ["purok"], select: { purok: true }, orderBy: { purok: "asc" } }),
    db.household.findMany({
      where: {
        status: "ACTIVE",
        ...(codes?.length ? { code: { in: codes } } : {}),
        ...(sp.purok ? { purok: sp.purok } : {}),
        ...(who === "unclaimed" ? { claimedAt: null } : {}),
      },
      orderBy: { code: "asc" },
      take: 500,
      include: { qrCodes: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  const printable = households.filter((h) => h.qrCodes.length > 0);
  const missing = households.length - printable.length;
  const stickers = await Promise.all(printable.map(async (h) => ({ h, svg: await qrSvg(h.qrCodes[0].token) })));

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <Link href="/admin/households" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline">
          <Icon name="arrow-left" className="h-5 w-5" />
          Households
        </Link>
        <PageHeader
          title="Print QR stickers"
          description={`${stickers.length} ${stickers.length === 1 ? "sticker" : "stickers"} ready. Print on sticker paper, or on plain paper and laminate.`}
          actions={stickers.length > 0 && <div className="w-40"><PrintButton label="Print" /></div>}
        />

        {codes?.length ? (
          <Notice>
            Printing {codes.join(", ")}.{" "}
            <Link href="/admin/households/print" className="font-semibold underline">Print other households</Link>
          </Notice>
        ) : (
          <form className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div>
              <label htmlFor="purok" className="mb-1 block text-sm font-semibold">Purok</label>
              <select id="purok" name="purok" defaultValue={sp.purok ?? ""} className="field-box">
                <option value="">All puroks</option>
                {puroks.map((p) => <option key={p.purok}>{p.purok}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="who" className="mb-1 block text-sm font-semibold">Households</label>
              <select id="who" name="who" defaultValue={who} className="field-box">
                <option value="all">All active households</option>
                <option value="unclaimed">Not signed up in the app yet</option>
              </select>
            </div>
            <fieldset className="space-y-1 text-sm">
              <legend className="mb-1 font-semibold">Also print</legend>
              <label className="flex min-h-9 items-center gap-2">
                <input type="checkbox" name="names" defaultChecked={showNames} className="h-5 w-5 shrink-0 accent-forest" />
                Household name on the sticker
              </label>
              <label className="flex min-h-9 items-center gap-2">
                <input type="checkbox" name="slips" defaultChecked={showSlips} className="h-5 w-5 shrink-0 accent-forest" />
                Sign-up slip (cut off, hand to the resident)
              </label>
            </fieldset>
            <button className="btn btn-primary">Show stickers</button>
          </form>
        )}
        {missing > 0 && (
          <Notice tone="warn">
            {missing} {missing === 1 ? "household has" : "households have"} no active QR code, so {missing === 1 ? "it isn’t" : "they aren’t"} shown.
            Issue a new code from the household’s page.
          </Notice>
        )}
      </div>

      {stickers.length === 0 ? (
        <EmptyState icon="qr" title="No stickers to print" body="No active households match. Change the choices above." />
      ) : (
        <ul className="sticker-sheet grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stickers.map(({ h, svg }) => (
            <li key={h.id} className="sticker rounded-2xl border-2 border-dashed border-line bg-white p-3 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-forest">ScrapScan</p>
              <div
                role="img"
                aria-label={`QR code for household ${h.code}`}
                className="mx-auto mt-1 aspect-square w-full max-w-44 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <p className="whitespace-nowrap text-xl font-extrabold tracking-wide">{h.code}</p>
              {showNames && <p className="truncate text-xs text-slate-green">{h.name}</p>}
              <p className="mt-1 text-[0.65rem] leading-tight text-slate-green">Put this on your bins. Your collector scans it.</p>
              {showSlips && !h.claimedAt && (
                <div className="mt-3 border-t-2 border-dashed border-line pt-2 text-left text-[0.7rem] leading-snug">
                  <p className="font-bold">✂ Sign-up slip for {h.code}</p>
                  <p>To see your points, sign up in ScrapScan, choose “I have a sign-up code” and enter:</p>
                  <p className="mt-0.5 text-base font-extrabold tracking-widest text-forest">{formatClaimCode(h.claimCode)}</p>
                  <p className="text-slate-green">Family members can use it too. Keep it private.</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
