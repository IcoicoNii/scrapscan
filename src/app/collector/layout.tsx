import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

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
        { href: "/collector/profile", label: "Profile", icon: "user" },
      ]}
    >
      {children}
    </AppShell>
  );
}
