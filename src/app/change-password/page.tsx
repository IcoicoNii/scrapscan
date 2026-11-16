import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { format } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { AuthFrame } from "@/components/auth-frame";
import { Icon } from "@/components/icons";
import { LogoutForm } from "@/components/logout-form";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const forced = user.mustChangePassword;
  // Admins always see English, like the rest of the admin area.
  const { t: dict } = await getI18n();
  const t = user.role === "ADMIN" ? (await import("@/lib/i18n/en")).en : dict;
  const c = t.changePassword;

  return (
    <AuthFrame>
      <div className="mx-auto w-full max-w-md px-6 py-8 md:rounded-[2rem] md:bg-white md:p-8 md:shadow-pop">
        {!forced && (
          <Link href={homeFor(user.role)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline">
            <Icon name="arrow-left" className="h-5 w-5" />
            {t.common.back}
          </Link>
        )}
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{forced ? c.forcedTitle : c.title}</h1>
        <p className="mt-2 text-slate-green">
          {forced ? format(c.forcedIntro, { name: user.name.split(" ")[0] }) : c.intro}
        </p>
        <ChangePasswordForm currentLabel={forced ? c.temporary : c.current} english={user.role === "ADMIN"} />
        {forced && (
          <LogoutForm className="btn btn-ghost mt-3 w-full" offlineData={user.role === "COLLECTOR"}>
            {c.logOutInstead}
          </LogoutForm>
        )}
      </div>
    </AuthFrame>
  );
}
