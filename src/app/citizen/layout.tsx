import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function CitizenLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("CITIZEN");
  return (
    <AppShell
      roleLabel="Citizen"
      homeHref="/citizen"
      profileHref="/citizen/profile"
      userName={user.name}
      nav={[
        { href: "/citizen", label: "Home", icon: "home", exact: true },
        { href: "/citizen/history", label: "History", icon: "clock" },
        { href: "/citizen/rewards", label: "Rewards", icon: "gift" },
        { href: "/citizen/profile", label: "Profile", icon: "user" },
      ]}
    >
      {children}
    </AppShell>
  );
}
