"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { initials } from "@/lib/format";
import { Icon } from "./icons";
import { LogoutForm } from "./logout-form";

// Mobile account menu. <details> works without JS; the effect only closes it after navigating,
// because the shell (and so this menu) stays mounted between pages.
export function UserMenu({
  userName,
  roleLabel,
  profileHref,
  offlineData,
}: {
  userName: string;
  roleLabel: string;
  profileHref?: string;
  offlineData?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  return (
    <details ref={ref} className="relative">
      <summary
        className="menu-summary flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-white/10"
        aria-label={`Account menu for ${userName}`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-lawn text-sm font-extrabold text-khaki ring-2 ring-white/25" aria-hidden="true">
          {initials(userName)}
        </span>
        <Icon name="chevron-down" className="h-5 w-5" />
      </summary>
      <div className="menu-panel on-light absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-line bg-white p-2 text-khaki shadow-pop">
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint text-sm font-extrabold text-forest" aria-hidden="true">
            {initials(userName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold">{userName}</p>
            <p className="text-sm text-slate-green">{roleLabel}</p>
          </div>
        </div>
        <div className="my-1 border-t border-line-soft" />
        {profileHref && (
          <Link href={profileHref} className="flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors hover:bg-mint">
            <Icon name="user" className="h-5 w-5 text-forest" />
            Profile
          </Link>
        )}
        <LogoutForm
          offlineData={offlineData}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold transition-colors hover:bg-mint"
        >
          <Icon name="logout" className="h-5 w-5 text-forest" />
          Log out
        </LogoutForm>
      </div>
    </details>
  );
}
