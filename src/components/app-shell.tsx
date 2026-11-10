import Link from "next/link";
import { BrandMark, Wordmark } from "./brand";
import { Icon } from "./icons";
import { NavLinks, type NavItem } from "./nav-links";
import { initials } from "@/lib/format";
import { UserMenu } from "./user-menu";
import { LogoutForm } from "./logout-form";

type Props = {
  roleLabel: string;
  userName: string;
  homeHref: string;
  profileHref?: string;
  nav: NavItem[];
  /** Collector pages: logout warns about unsent scans and clears offline data first. */
  offlineData?: boolean;
  children: React.ReactNode;
};

// Phone: top bar with account menu + bottom tabs. md: icon rail. lg: full sidebar.
// The sidebar is sticky so it stays in view on long pages. Same routes and content markup everywhere.
export function AppShell({ roleLabel, userName, homeHref, profileHref, nav, offlineData, children }: Props) {
  return (
    <div className="on-light min-h-dvh md:grid md:grid-cols-[5rem_1fr] lg:grid-cols-[16.5rem_1fr]">
      <aside className="surface-forest no-print sticky top-0 hidden h-dvh flex-col px-3 py-5 md:flex lg:px-4">
        <Link href={homeHref} className="flex items-center justify-center gap-3 rounded-xl lg:justify-start lg:px-2">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/15">
            <BrandMark className="h-7 w-7 text-lawn" />
          </span>
          <div className="hidden lg:block">
            <Wordmark className="text-xl" />
            <p className="mt-0.5 text-xs font-medium text-mint">{roleLabel} portal</p>
          </div>
        </Link>
        <nav aria-label="Main" className="mt-8">
          <p className="mb-2 hidden px-4 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-mint/80 lg:block">Menu</p>
          <NavLinks items={nav} variant="side" />
        </nav>
        <div className="mt-auto rounded-2xl bg-white/[0.07] p-2 ring-1 ring-inset ring-white/10 lg:p-3">
          <div className="hidden items-center gap-3 lg:flex">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lawn text-sm font-extrabold text-khaki"
            >
              {initials(userName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="truncate text-xs text-mint">{roleLabel}</p>
            </div>
          </div>
          <LogoutForm
            offlineData={offlineData}
            title="Log out"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white lg:mt-2 lg:justify-start lg:px-3"
          >
            <Icon name="logout" className="h-5 w-5" />
            <span className="sr-only lg:not-sr-only">Log out</span>
          </LogoutForm>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="glass-forest no-print sticky top-0 z-20 flex items-center justify-between px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-white shadow-[0_8px_24px_-16px_rgb(27_67_0/0.8)] md:hidden">
          <Link href={homeHref} className="flex min-h-11 items-center gap-2">
            <BrandMark className="h-8 w-8 text-lawn" />
            <Wordmark className="text-lg" />
          </Link>
          <UserMenu userName={userName} roleLabel={roleLabel} profileHref={profileHref} offlineData={offlineData} />
        </header>

        <main
          id="main"
          className="page-in mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:px-8 md:pb-12 md:pt-10 lg:px-10"
        >
          {children}
        </main>

        <nav
          aria-label="Main"
          className="glass-light no-print fixed inset-x-0 bottom-0 z-20 border-t border-line pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(36_89_0/0.25)] md:hidden"
        >
          <NavLinks items={nav} variant="bottom" />
        </nav>
      </div>
    </div>
  );
}
