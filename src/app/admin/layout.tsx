import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  return (
    <AppShell
      roleLabel="Barangay admin"
      userName={user.name}
      homeHref="/admin"
      nav={[
        { href: "/admin", label: "Overview", icon: "chart", exact: true },
        { href: "/admin/households", label: "Households", icon: "houses" },
        { href: "/admin/collections", label: "Collections", icon: "list", phone: false },
        { href: "/admin/reviews", label: "Reviews", icon: "flag" },
        { href: "/admin/rewards", label: "Rewards", icon: "gift" },
        { href: "/admin/accounts", label: "Accounts", icon: "users", phone: false },
        { href: "/admin/audit", label: "Audit log", icon: "clock", phone: false },
      ]}
    >
      {children}
    </AppShell>
  );
}
