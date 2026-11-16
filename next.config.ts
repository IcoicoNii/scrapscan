import type { NextConfig } from "next";

// Note: the scaffold enabled `cacheComponents`. It was turned off on purpose:
// nearly every ScrapScan page is per-user and dynamic, so it adds Suspense
// requirements without any caching benefit for this app.
const nextConfig: NextConfig = {
  // The offline service worker (public/sw.js) must always be re-checked, and may only run same-origin code.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      // The reset token is in this page's URL: never send it to another site in a Referer header.
      { source: "/reset-password", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
