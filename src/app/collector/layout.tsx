import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { SyncAgent } from "./sync-agent";

export default async function CollectorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("COLLECTOR");
  return (
    <AppShell
      roleLabel="Collector"
      homeHref="/collector"
      profileHref="/collector/profile"
      userName={user.name}
      nav={[
        { href: "/collector", label: "Home", icon: "home", exact: true },
        { href: "/collector/scan", label: "Scan", icon: "qr" },
        { href: "/collector/queue", label: "Saved", icon: "clock" },
        { href: "/collector/profile", label: "Profile", icon: "user" },
      ]}
      offlineData
    >
      <SyncAgent collectorId={user.id} />
      {children}
    </AppShell>
  );
}
