import type { NextConfig } from "next";

// Note: the scaffold enabled `cacheComponents`. It was turned off on purpose:
// nearly every ScrapScan page is per-user and dynamic, so it adds Suspense
// requirements without any caching benefit for this app.
const nextConfig: NextConfig = {
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
