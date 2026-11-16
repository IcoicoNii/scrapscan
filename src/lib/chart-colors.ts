// Chart colors, validated with the data-viz palette validator against the white card surface.
// Kept out of the "use client" charts module: server components can't read plain values exported from one.
export const CHART_COLORS = {
  /** Single-series marks and "points earned". */
  primary: "#2f7a12",
  /** Second series ("points spent"). Passes CVD separation against primary. */
  secondary: "#2a78d6",
  /** Ordinal ramp, low → high (0, 5, 10 points). One hue, light end >= 2:1 on white. */
  ordinal: ["#8ab95a", "#4c891c", "#1b4300"] as const,
};
