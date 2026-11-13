import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { AuthFrame } from "@/components/auth-frame";
import { Icon } from "@/components/icons";
import { LogoutForm } from "@/components/logout-form";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const forced = user.mustChangePassword;

  return (
    <AuthFrame>
      <div className="mx-auto w-full max-w-md px-6 py-8 md:rounded-[2rem] md:bg-white md:p-8 md:shadow-pop">
        {!forced && (
          <Link href={homeFor(user.role)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline">
            <Icon name="arrow-left" className="h-5 w-5" />
            Back
          </Link>
        )}
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{forced ? "Choose your password" : "Change password"}</h1>
        <p className="mt-2 text-slate-green">
          {forced
            ? `Hi ${user.name.split(" ")[0]}. You logged in with a temporary password from your barangay admin. Choose your own to continue.`
            : "You’ll stay logged in on this device. Other devices will be logged out."}
        </p>
        <ChangePasswordForm currentLabel={forced ? "Temporary password" : "Current password"} />
        {forced && (
          <LogoutForm className="btn btn-ghost mt-3 w-full" offlineData={user.role === "COLLECTOR"}>
            Log out instead
          </LogoutForm>
        )}
      </div>
    </AuthFrame>
  );
}
