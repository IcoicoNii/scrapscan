import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { qrSvg } from "@/lib/qr";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { HouseholdStatusNotice } from "@/components/household-status";
import { getI18n } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/config";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "My QR code" };


export default async function MyQrPage() {
  const user = await requirePagePermission("qr:read:own");
  const { t } = await getI18n();
  const c = t.citizen;
  const tips = [c.qrTip1, c.qrTip2, c.qrTip3];
  if (!user.householdId) {
    return <EmptyState icon="houses" title={c.noHousehold} body={c.noHouseholdBody} />;
  }

  const [household, qr] = await Promise.all([
    db.household.findUnique({ where: { id: user.householdId }, select: { code: true, name: true, status: true, statusNote: true } }),
    db.qrCode.findFirst({
      where: { householdId: user.householdId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!household || !qr) {
    return (
      <div className="space-y-6">
        <PageHeader title={c.qrTitle} />
        <EmptyState
          icon="qr"
          title={c.qrNone}
          body={c.qrNoneBody}
        />
      </div>
    );
  }

  const svg = await qrSvg(qr.token); // library-generated SVG, contains no user input

  return (
    <div className="space-y-6">
      <PageHeader className="no-print" title={c.qrTitle} description={c.qrIntro} />
      <div className="no-print">
        <HouseholdStatusNotice status={household.status} statusNote={household.statusNote} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start">
        <section aria-label={c.qrTitle} className="card mx-auto w-full max-w-sm text-center lg:max-w-none lg:p-8">
          <div
            role="img"
            aria-label={format(c.qrLabel, { code: household.code })}
            className="mx-auto aspect-square w-full max-w-72 rounded-2xl bg-white p-3 ring-1 ring-line [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="mt-5 text-3xl font-extrabold tracking-wide text-forest">{household.code}</p>
          <p className="text-sm text-slate-green">{household.name}</p>
        </section>

        <div className="no-print mx-auto w-full max-w-sm space-y-6 lg:max-w-none">
          <section aria-labelledby="tips" className="card">
            <h2 id="tips" className="text-lg font-bold">
              {c.qrUsing}
            </h2>
            <ul className="mt-3 space-y-3">
              {tips.map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="icon-tile mt-0.5 h-6 w-6 rounded-lg"><Icon name="check" className="h-4 w-4" /></span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            <PrintButton label={c.qrPrint} />
            <a href="/citizen/qr/download" className="btn btn-primary">
              {c.qrDownload}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
