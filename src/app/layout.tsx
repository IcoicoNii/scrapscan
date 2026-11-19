import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "@fontsource-variable/montserrat";
import "./globals.css";
import { I18nProvider } from "@/components/i18n";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { HTML_LANG } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: { default: "ScrapScan", template: "%s · ScrapScan" },
  description: "A community-driven QR-based waste segregation and rewards system.",
  applicationName: "ScrapScan",
};

// Zooming stays enabled on purpose (accessibility).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#245900",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The reader's language (saved choice or browser preference). Admin pages switch back to English themselves.
  const locale = await getLocale();
  return (
    <ClerkProvider>
    <html lang={HTML_LANG[locale]}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-forest"
        >
          {DICTIONARIES[locale].common.skipToContent}
        </a>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
    </ClerkProvider>
  );
}
