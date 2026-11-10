import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ScanFlow } from "./scan-flow";

export const metadata: Metadata = { title: "Record a collection" };

export default async function ScanPage() {
  await requirePagePermission("collection:create");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader eyebrow="Collector portal" title="Record a collection" />
      <ScanFlow />
    </div>
  );
}
