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
        { href: "/admin/reviews", label: "Reviews", icon: "flag" },
      ]}
    >
      {children}
    </AppShell>
  );
}
