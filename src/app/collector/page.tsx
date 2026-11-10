import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatPoints } from "@/lib/format";
import { Icon } from "@/components/icons";
import { PageHeader, SectionCard, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Collector home" };

const steps = [
  "Scan the QR code on the household’s container, or type the household number.",
  "Check each bin: biodegradable, recyclable and residual.",
  "Save. Points are worked out on the server and the household sees them right away.",
];

export default async function CollectorHome() {
  const user = await requirePagePermission("collection:read:own");
  const mine = await db.collection.count({ where: { collectorId: user.id } });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Collector portal" title={`Hello, ${user.name.split(" ")[0]}`} />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="scan-h" className="surface-forest rounded-[1.75rem] p-6 text-center shadow-lift lg:p-10">
          <h2 id="scan-h" className="sr-only">
            Scan
          </h2>
          <span className="relative mx-auto grid h-24 w-24 place-items-center">
            <span aria-hidden="true" className="absolute inset-0 rounded-[1.75rem] bg-lawn/25 blur-xl" />
            <span className="relative grid h-24 w-24 place-items-center rounded-[1.75rem] bg-white/10 ring-1 ring-inset ring-white/20">
              <Icon name="qr" className="h-12 w-12 text-lawn" />
            </span>
          </span>
          <Link href="/collector/scan" className="btn btn-lawn mt-6 w-full py-5 text-lg">
            <Icon name="qr" className="h-7 w-7" />
            Scan household QR
          </Link>
          <p className="mt-3 text-sm text-mint">No QR code on the container? You can type the household number instead.</p>
        </section>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <StatCard label="Collections recorded" value={formatPoints(mine)} icon="check" />
          <StatCard label="Waiting to sync" value={0} note="Saving scans offline is coming next. For now you need signal to save." icon="clock" />
        </div>
      </div>

      <SectionCard id="how" title="How scanning works">
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="icon-tile h-9 w-9 rounded-xl text-sm font-extrabold">
                {i + 1}
              </span>
              <span className="text-slate-green">{s}</span>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}
