import { AppShell } from "@/components/app-shell";
import { I18nProvider } from "@/components/i18n";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  // Admin screens are English only, whatever language this device has chosen.
  return (
    <I18nProvider locale="en">
    <AppShell
      lang="en"
      roleLabel="Barangay admin"
      userName={user.name}
      homeHref="/admin"
      nav={[
        { href: "/admin", label: "Overview", icon: "home", exact: true },
        { href: "/admin/households", label: "Households", icon: "houses" },
        { href: "/admin/collections", label: "Collections", icon: "list", phone: false },
        { href: "/admin/analytics", label: "Analytics", icon: "chart", phone: false },
        { href: "/admin/reviews", label: "Reviews", icon: "flag" },
        { href: "/admin/rewards", label: "Rewards", icon: "gift" },
        { href: "/admin/accounts", label: "Accounts", icon: "users", phone: false },
        { href: "/admin/audit", label: "Audit log", icon: "clock", phone: false },
      ]}
    >
      {children}
    </AppShell>
    </I18nProvider>
  );
}
