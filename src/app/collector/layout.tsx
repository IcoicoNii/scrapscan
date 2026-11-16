import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { SyncAgent } from "./sync-agent";

export default async function CollectorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("COLLECTOR");
  const { locale, t } = await getI18n();
  return (
    <AppShell
      lang={locale}
      languageSwitch
      roleLabel={t.common.collectorRole}
      homeHref="/collector"
      profileHref="/collector/profile"
      userName={user.name}
      nav={[
        { href: "/collector", label: t.common.home, icon: "home", exact: true },
        { href: "/collector/scan", label: t.common.scan, icon: "qr" },
        { href: "/collector/queue", label: t.common.saved, icon: "clock" },
        { href: "/collector/profile", label: t.common.profile, icon: "user" },
      ]}
      offlineData
    >
      <SyncAgent collectorId={user.id} />
      {children}
    </AppShell>
  );
}
