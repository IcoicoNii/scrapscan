"use client";

import "@fontsource-variable/montserrat";
import "./globals.css";
import { ErrorState } from "@/components/error-state";

// Replaces the root layout when it fails, so it brings its own document and styles.
export default function GlobalError(props: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong · ScrapScan</title>
        <main id="main" className="min-h-dvh bg-ivory">
          <ErrorState {...props} />
        </main>
      </body>
    </html>
  );
}
