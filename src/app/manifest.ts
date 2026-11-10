import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ScrapScan",
    short_name: "ScrapScan",
    description: "A community-driven QR-based waste segregation and rewards system.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfff2",
    theme_color: "#245900",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
