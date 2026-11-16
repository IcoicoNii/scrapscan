import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export default async function CitizenLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("CITIZEN");
  const { locale, t } = await getI18n();
  return (
    <AppShell
      lang={locale}
      languageSwitch
      roleLabel={t.common.citizenRole}
      homeHref="/citizen"
      profileHref="/citizen/profile"
      userName={user.name}
      nav={[
        { href: "/citizen", label: t.common.home, icon: "home", exact: true },
        { href: "/citizen/history", label: t.common.history, icon: "clock" },
        { href: "/citizen/rewards", label: t.common.rewards, icon: "gift" },
        { href: "/citizen/profile", label: t.common.profile, icon: "user" },
      ]}
    >
      {children}
    </AppShell>
  );
}
