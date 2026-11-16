"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CHART_COLORS } from "@/lib/chart-colors";

// Small SVG charts for the admin analytics. No chart library: the data is tiny and the marks are simple.
// Specs (from the data-viz method): columns <= 24px with a 4px rounded data end and a square baseline,
// 2px surface gaps between touching marks, hairline gridlines, text in ink colors (never the series color),
// a legend for 2+ series, hover/keyboard readout, and a table view so no value is tooltip-only.
// Palette validated with the data-viz validator against the white card surface.


const INK = "#2c514c"; // slate-green: axis text
const GRID = "#e2ead5"; // line: hairline gridlines
const BASE = "#b9c4a8"; // baseline
const fmt = new Intl.NumberFormat("en-PH");

export type Series = { name: string; color: string };
/** label: full name (readout, table); axisLabel: optional shorter form for the x axis. */
export type Column = { key: string; label: string; axisLabel?: string; values: number[] };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** 0 and up to three more round ticks covering max. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(6));
}

/** A column whose data end (top) has 4px rounded corners and whose baseline end is square. */
function columnPath(x: number, y: number, w: number, h: number, round: boolean) {
  if (h <= 0) return "";
  const r = round ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Columns over time. `stacked` stacks the series (optionally as 100% shares with `normalize`);
 * `grouped` puts them side by side. One series is a plain column chart.
 */
export function ColumnChart({
  title,
  description,
  columns,
  series,
  layout = "grouped",
  normalize = false,
  unit = "",
  height = 220,
  emptyText = "No data in this period.",
}: {
  title: string;
  description?: string;
  columns: Column[];
  series: Series[];
  layout?: "grouped" | "stacked";
  normalize?: boolean;
  unit?: string;
  height?: number;
  emptyText?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const totals = columns.map((c) => c.values.reduce((s, v) => s + v, 0));
  const empty = totals.every((t) => t === 0);

  const m = { top: 12, right: 8, bottom: 26, left: normalize ? 40 : 36 };
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const max = normalize ? 1 : Math.max(...columns.map((c, i) => (layout === "stacked" ? totals[i] : Math.max(...c.values))), 0);
  const ticks = normalize ? [0, 0.5, 1] : niceTicks(max);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => m.top + plotH - (v / top) * plotH;
  const band = columns.length ? plotW / columns.length : 0;
  const groupW = Math.min(layout === "grouped" ? 24 * series.length + 2 * (series.length - 1) : 24, band * 0.72);
  const barW = layout === "grouped" ? (groupW - 2 * (series.length - 1)) / series.length : groupW;
  // Label every nth column so x labels never collide (~64px each).
  const every = Math.max(1, Math.ceil(64 / Math.max(band, 1)));

  const readout = (i: number) => {
    const col = columns[i];
    const parts = series.map((s, j) => {
      const v = col.values[j];
      return { s, text: normalize ? `${fmt.format(v)} (${totals[i] ? pct(v / totals[i]) : "–"})` : `${fmt.format(v)}${unit}` };
    });
    return { label: col.label, parts };
  };
  const tip = active !== null ? readout(active) : null;

  const onKey = (e: React.KeyboardEvent) => {
    if (!columns.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const d = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) => (a === null ? (d > 0 ? 0 : columns.length - 1) : Math.min(columns.length - 1, Math.max(0, a + d))));
    }
    if (e.key === "Escape") setActive(null);
  };

  return (
    <figure className="space-y-3">
      <figcaption>
        <p className="font-bold">{title}</p>
        {description && <p className="text-sm text-slate-green">{description}</p>}
      </figcaption>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Legend">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-3 rounded-[3px]" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={ref}
        className="relative rounded-xl outline-offset-4"
        tabIndex={empty ? undefined : 0}
        role="group"
        aria-label={`${title}. Use the left and right arrow keys to read each ${columns.length > 0 ? "column" : "value"}.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        {empty ? (
          <p className="grid place-items-center rounded-xl border border-dashed border-line text-sm text-slate-green" style={{ height }}>
            {emptyText}
          </p>
        ) : (
          width > 0 && (
            <svg width={width} height={height} aria-hidden="true" className="block select-none">
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASE : GRID} strokeWidth={1} />
                  <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={INK} className="tabular-nums">
                    {normalize ? pct(t) : fmt.format(t)}
                  </text>
                </g>
              ))}
              {columns.map((col, i) => {
                const x0 = m.left + band * i + (band - groupW) / 2;
                const isActive = active === i;
                let stackTop = 0;
                const lastNonZero = col.values.reduce((last, v, j) => (v > 0 ? j : last), -1);
                return (
                  <g key={col.key}>
                    {isActive && <rect x={m.left + band * i} y={m.top} width={band} height={plotH} fill="#eef3e4" />}
                    {col.values.map((raw, j) => {
                      const v = normalize ? (totals[i] ? raw / totals[i] : 0) : raw;
                      if (layout === "stacked") {
                        const y1 = y(stackTop + v);
                        const h = y(stackTop) - y1;
                        stackTop += v;
                        // 2px surface gap between stacked segments (taken from the lower edge of upper segments).
                        const gap = stackTop - v > 0 && h > 2 ? 2 : 0;
                        return <path key={j} d={columnPath(x0, y1, barW, h - gap, j === lastNonZero)} fill={series[j].color} />;
                      }
                      const x = x0 + j * (barW + 2);
                      return <path key={j} d={columnPath(x, y(v), barW, y(0) - y(v), true)} fill={series[j].color} />;
                    })}
                    {i % every === 0 && (
                      <text x={m.left + band * i + band / 2} y={height - 8} textAnchor="middle" fontSize={11} fill={INK}>
                        {col.axisLabel ?? col.label}
                      </text>
                    )}
                    {/* The hit target is the whole column band, not just the painted bar. */}
                    <rect x={m.left + band * i} y={m.top} width={band} height={plotH} fill="transparent" onPointerEnter={() => setActive(i)} />
                  </g>
                );
              })}
            </svg>
          )
        )}
        <div aria-live="polite" className="sr-only">
          {tip && `${tip.label}: ${tip.parts.map((p) => `${p.s.name} ${p.text}`).join(", ")}`}
        </div>
        {tip && active !== null && width > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-pop"
            style={{
              left: Math.min(Math.max(0, m.left + band * active + band / 2 - 72), Math.max(0, width - 160)),
              transform: "translateY(-8px)",
            }}
          >
            <p className="mb-1 text-xs font-semibold text-slate-green">{tip.label}</p>
            {tip.parts.map((p) => (
              <p key={p.s.name} className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded" style={{ background: p.s.color }} />
                <strong className="tabular-nums">{p.text}</strong>
                <span className="text-slate-green">{p.s.name}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <DataTable
        id={id}
        caption={title}
        head={["", ...series.map((s) => s.name)]}
        rows={columns.map((c, i) => [c.label, ...c.values.map((v) => (normalize && totals[i] ? `${fmt.format(v)} (${pct(v / totals[i])})` : `${fmt.format(v)}${unit}`))])}
      />
    </figure>
  );
}

/** Horizontal bars with the value at the tip. For ranked or categorical rows (puroks, collectors). */
export function BarList({
  title,
  description,
  rows,
  percent = false,
  color = CHART_COLORS.primary,
  emptyText = "No data in this period.",
}: {
  title: string;
  description?: string;
  rows: { label: string; value: number; note?: string }[];
  percent?: boolean;
  color?: string;
  emptyText?: string;
}) {
  const id = useId();
  const max = percent ? 1 : Math.max(1, ...rows.map((r) => r.value));
  const show = (v: number) => (percent ? pct(v) : fmt.format(v));
  return (
    <figure className="space-y-3">
      <figcaption>
        <p className="font-bold">{title}</p>
        {description && <p className="text-sm text-slate-green">{description}</p>}
      </figcaption>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-slate-green">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} title={`${r.label}: ${show(r.value)}${r.note ? ` · ${r.note}` : ""}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-semibold">{r.label}</span>
                {r.note && <span className="shrink-0 text-xs text-slate-green">{r.note}</span>}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-4 flex-1 rounded-r-[4px]" style={{ background: GRID }} aria-hidden="true">
                  <div className="h-full rounded-r-[4px]" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">{show(r.value)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <DataTable id={id} caption={title} head={["", percent ? "Share" : "Count", ""]} rows={rows.map((r) => [r.label, show(r.value), r.note ?? ""])} />
      )}
    </figure>
  );
}

function DataTable({ id, caption, head, rows }: { id: string; caption: string; head: string[]; rows: string[][] }) {
  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-forest">Show data</summary>
      <div className="table-wrap mt-2 max-h-80 overflow-y-auto">
        <table className="data-table" aria-describedby={`${id}-cap`}>
          <caption id={`${id}-cap`} className="sr-only">{caption}</caption>
          <thead>
            <tr>{head.map((h, i) => <th key={i} scope="col" className="px-3 py-2">{h || <span className="sr-only">Period</span>}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) =>
                  j === 0 ? <th key={j} scope="row" className="px-3 py-2 font-semibold">{cell}</th> : <td key={j} className="px-3 py-2 tabular-nums">{cell}</td>,
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

