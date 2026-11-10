import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { Icon } from "@/components/icons";
import { Notice, PageHeader } from "@/components/ui";
import { HouseholdForm } from "../household-form";

export const metadata: Metadata = { title: "Add household" };

export default async function NewHouseholdPage() {
  await requirePagePermission("household:create");
  return (
    <div className="space-y-6">
      <Link href="/admin/households" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline">
        <Icon name="arrow-left" className="h-5 w-5" />
        Households
      </Link>
      <PageHeader title="Add a household" description="Each household gets a QR code and a one-time sign-up code." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_1fr] lg:items-start">
        <HouseholdForm />
        <Notice>
          After you add a household, give the resident the sign-up code shown here. They enter it when they create their
          account. You can always find it again in the households list until they sign up.
        </Notice>
      </div>
    </div>
  );
}
