import type { Metadata, Viewport } from "next";
import "@fontsource-variable/montserrat";
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-forest"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
