"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };

// "side" is an icon rail at md and a full sidebar at lg; "bottom" is the phone tab bar.
export function NavLinks({ items, variant }: { items: NavItem[]; variant: "bottom" | "side" }) {
  const pathname = usePathname();
  return (
    <ul className={variant === "bottom" ? "flex justify-around" : "space-y-1"}>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href} className={variant === "bottom" ? "flex-1" : undefined}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={variant === "side" ? item.label : undefined}
              className={
                variant === "bottom"
                  ? `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
                      active ? "text-forest" : "text-slate-green hover:text-forest"
                    }`
                  : `flex min-h-12 items-center justify-center gap-3 rounded-xl px-3 font-semibold transition-all duration-150 lg:justify-start lg:px-4 ${
                      active
                        ? "bg-lawn text-khaki shadow-[0_8px_20px_-10px_rgb(135_233_37/0.9)]"
                        : "text-white/85 hover:bg-white/10 hover:text-white"
                    }`
              }
            >
              <span
                className={
                  variant === "bottom"
                    ? `rounded-full px-4 py-1 transition-colors duration-200 ${active ? "bg-lawn text-khaki" : ""}`
                    : undefined
                }
              >
                <Icon name={item.icon} className={variant === "bottom" ? "h-6 w-6" : "h-5 w-5"} />
              </span>
              <span className={variant === "side" ? "sr-only lg:not-sr-only" : undefined}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
