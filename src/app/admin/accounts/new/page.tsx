import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { Icon } from "@/components/icons";
import { Notice, PageHeader, SectionCard } from "@/components/ui";
import { NewAccountForm } from "../account-forms";

export const metadata: Metadata = { title: "Add account" };

export default async function NewAccountPage() {
  await requirePagePermission("user:manage");
  return (
    <div className="space-y-6">
      <Link href="/admin/accounts" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline">
        <Icon name="arrow-left" className="h-5 w-5" />
        Accounts
      </Link>
      <PageHeader title="Add a collector or admin" description="You’ll get a temporary password to give them. They choose their own when they first log in." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_1fr] lg:items-start">
        <SectionCard id="new" title="Account details">
          <NewAccountForm />
        </SectionCard>
        <Notice>Residents don’t need an account from you: they sign up in the app with the sign-up code on their household’s slip.</Notice>
      </div>
    </div>
  );
}
