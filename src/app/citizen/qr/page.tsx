import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { qrSvg } from "@/lib/qr";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "My QR code" };

const tips = [
  "Print it and stick it on your trash container where the collector can see it.",
  "Keep it dry and uncovered. A plastic sleeve or tape helps.",
  "If it can’t be scanned, the collector can type your household number instead.",
];

export default async function MyQrPage() {
  const user = await requirePagePermission("qr:read:own");
  if (!user.householdId) {
    return <EmptyState icon="houses" title="No household linked yet" body="Ask your barangay admin to link your account." />;
  }

  const [household, qr] = await Promise.all([
    db.household.findUnique({ where: { id: user.householdId }, select: { code: true, name: true } }),
    db.qrCode.findFirst({
      where: { householdId: user.householdId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!household || !qr) {
    return (
      <div className="space-y-6">
        <PageHeader title="My QR code" />
        <EmptyState
          icon="qr"
          title="No active QR code"
          body="Your household’s QR code was turned off. Ask your barangay admin to issue a new one."
        />
      </div>
    );
  }

  const svg = await qrSvg(qr.token); // library-generated SVG, contains no user input

  return (
    <div className="space-y-6">
      <PageHeader className="no-print" title="My QR code" description="Your collector scans this to record your household’s collection." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start">
        <section aria-label="Household QR code" className="card mx-auto w-full max-w-sm text-center lg:max-w-none lg:p-8">
          <div
            role="img"
            aria-label={`QR code for household ${household.code}`}
            className="mx-auto aspect-square w-full max-w-72 rounded-2xl bg-white p-3 ring-1 ring-line [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="mt-5 text-3xl font-extrabold tracking-wide text-forest">{household.code}</p>
          <p className="text-sm text-slate-green">{household.name}</p>
        </section>

        <div className="no-print mx-auto w-full max-w-sm space-y-6 lg:max-w-none">
          <section aria-labelledby="tips" className="card">
            <h2 id="tips" className="text-lg font-bold">
              Using your QR code
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
            <PrintButton />
            <a href="/citizen/qr/download" className="btn btn-primary">
              Download QR code
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
