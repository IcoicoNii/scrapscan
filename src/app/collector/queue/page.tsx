import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { QueueList } from "./queue-list";

export const metadata: Metadata = { title: "Saved scans" };

export default async function QueuePage() {
  const user = await requirePagePermission("collection:create");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        eyebrow="Collector portal"
        title="Saved scans"
        description="Scans saved on this phone that haven’t reached the server yet."
      />
      <QueueList collectorId={user.id} />
    </div>
  );
}
