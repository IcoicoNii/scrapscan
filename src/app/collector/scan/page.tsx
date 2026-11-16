import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ScanFlow } from "./scan-flow";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Record a collection" };

export default async function ScanPage() {
  const user = await requirePagePermission("collection:create");
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader eyebrow={t.collector.portal} title={t.collector.recordTitle} />
      <ScanFlow collectorId={user.id} />
    </div>
  );
}
