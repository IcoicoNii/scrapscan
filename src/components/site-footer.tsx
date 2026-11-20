"use client";

import Link from "next/link";
import { format } from "@/lib/i18n/config";
import { BrandMark, Wordmark } from "./brand";
import { Icon } from "./icons";
import { useI18n } from "./i18n";

// Placeholder contact details for the pilot. Swap in the barangay's real ones before launch.
export const CONTACT = {
  generalEmail: "scrapscan.support@gmail.com",
  techEmail: "scrapscan.techhelp@gmail.com",
  address: "Barangay Hall, P. Paredes St., Sampaloc, Manila",
} as const;

const linkClass =
  "inline-flex min-h-11 items-center text-white/85 underline-offset-4 transition-colors hover:text-white hover:underline md:min-h-9";

// Footer for pages anyone can open (landing, terms, privacy). Sits on the dark brand surface.
export function SiteFooter() {
  const { t } = useI18n();
  const f = t.footer;
  const quickLinks = [
    { href: "/#about", label: f.aboutLink },
    { href: "/#how", label: f.howItWorks },
    { href: "/#points", label: f.howPoints },
    { href: "/#who", label: f.whoLink },
    { href: "/login", label: t.common.logIn },
    { href: "/register", label: t.landing.create },
  ];

  return (
    <footer className="surface-forest pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-12 sm:px-6 md:grid-cols-2 md:pt-16 lg:grid-cols-[1.3fr_1fr_1.2fr]">
        <div className="md:col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex min-h-11 items-center gap-3">
            <BrandMark className="h-10 w-10 text-lawn" />
            <Wordmark className="text-2xl" />
          </Link>
          <p className="mt-3 text-sm font-semibold text-mint">{f.tagline}</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">{f.blurb}</p>
          <a href={`mailto:${CONTACT.generalEmail}`} className="btn btn-glass btn-sm mt-6">
            <Icon name="mail" className="h-5 w-5" />
            {f.emailUs}
          </a>
        </div>

        <nav aria-labelledby="footer-links">
          <h2 id="footer-links" className="text-xs font-bold uppercase tracking-wider text-lawn">
            {f.quickLinks}
          </h2>
          <ul className="mt-3 text-sm md:space-y-1">
            {quickLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact" className="text-xs font-bold uppercase tracking-wider text-lawn">
            {f.contactTitle}
          </h2>
          <address className="mt-4 space-y-5 text-sm not-italic">
            <ContactItem icon="mail" title={f.generalTitle}>
              <a href={`mailto:${CONTACT.generalEmail}`} className={`${linkClass} [overflow-wrap:anywhere]`}>
                {CONTACT.generalEmail}
              </a>
            </ContactItem>
            <ContactItem icon="mail" title={f.techTitle}>
              <a href={`mailto:${CONTACT.techEmail}`} className={`${linkClass} [overflow-wrap:anywhere]`}>
                {CONTACT.techEmail}
              </a>
            </ContactItem>
            <ContactItem icon="pin" title={f.walkInTitle}>
              <p className="text-white/85">{CONTACT.address}</p>
              <p className="mt-0.5 text-white/70">{f.hours}</p>
            </ContactItem>
          </address>
        </section>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-white/70 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-6">
          <p>{format(f.rights, { year: new Date().getFullYear() })}</p>
          <ul className="flex items-center gap-1">
            <li>
              <Link href="/terms" className={linkClass}>
                {f.termsLink}
              </Link>
            </li>
            <li aria-hidden="true" className="px-1.5">
              ·
            </li>
            <li>
              <Link href="/privacy" className={linkClass}>
                {f.privacyLink}
              </Link>
            </li>
          </ul>
          <p>{f.builtWith}</p>
        </div>
      </div>
    </footer>
  );
}

function ContactItem({ icon, title, children }: { icon: "mail" | "pin"; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lawn ring-1 ring-inset ring-white/15">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-white">{title}</p>
        {children}
      </div>
    </div>
  );
}
