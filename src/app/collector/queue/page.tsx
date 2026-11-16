import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { QueueList } from "./queue-list";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Saved scans" };

export default async function QueuePage() {
  const user = await requirePagePermission("collection:create");
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        eyebrow={t.collector.portal}
        title={t.collector.savedTitle}
        description={t.collector.savedIntro}
      />
      <QueueList collectorId={user.id} />
    </div>
  );
}
