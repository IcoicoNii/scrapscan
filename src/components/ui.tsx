import { Icon, type IconName } from "./icons";

// Small shared building blocks so every page has the same header, cards and states.
// Server-safe: no hooks, no client-only APIs.

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className = "",
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-semibold text-forest">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-slate-green">{description}</p>}
      </div>
      {actions && <div className="no-print flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
  tone = "light",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: "light" | "forest";
  icon?: IconName;
}) {
  const forest = tone === "forest";
  return (
    <div className={`flex h-full flex-col ${forest ? "surface-forest rounded-[1.25rem] p-5 shadow-lift lg:p-6" : "card"}`}>
      <div className="flex min-h-10 items-start justify-between gap-3">
        <p className={`text-sm font-semibold leading-5 ${forest ? "text-mint" : "text-slate-green"}`}>{label}</p>
        {icon &&
          (forest ? (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/12 text-lawn ring-1 ring-inset ring-white/15">
              <Icon name={icon} className="h-5 w-5" />
            </span>
          ) : (
            <span className="icon-tile h-10 w-10">
              <Icon name={icon} className="h-5 w-5" />
            </span>
          ))}
      </div>
      <p className={`mt-2 text-4xl font-extrabold tracking-tight tabular-nums ${forest ? "" : "text-forest"}`}>{value}</p>
      {note && <p className={`mt-1 text-sm ${forest ? "text-white/90" : "text-slate-green"}`}>{note}</p>}
    </div>
  );
}

export function EmptyState({
  icon = "info",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="relative grid place-items-center">
        <span aria-hidden="true" className="absolute h-24 w-24 rounded-full bg-mint/50 blur-xl" />
        <span className="icon-tile relative h-16 w-16 rounded-2xl">
          <Icon name={icon} className="h-8 w-8" />
        </span>
      </span>
      <p className="mt-4 text-lg font-bold">{title}</p>
      {body && <p className="mt-1 max-w-md text-slate-green">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium ${
        tone === "warn" ? "border-danger/15 bg-danger-soft text-danger" : "border-moss/20 bg-cream/70 text-khaki"
      }`}
    >
      <Icon name={tone === "warn" ? "warn" : "info"} className="mt-px h-5 w-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="h-2.5 w-full overflow-hidden rounded-full bg-track"
    >
      <div
        className="h-full rounded-full bg-linear-to-r from-moss to-forest transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function DetailList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line-soft">
      {items.map((i) => (
        <div key={i.label} className="grid gap-0.5 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="text-sm font-semibold text-slate-green">{i.label}</dt>
          <dd className="min-w-0 break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionCard({
  title,
  id,
  action,
  children,
  className = "",
}: {
  title: string;
  id: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`card ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="text-lg font-bold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageSkeleton({ variant = "cards" }: { variant?: "cards" | "list" }) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <div className="skeleton h-4 w-28" />
        <div className="skeleton h-8 w-56" />
      </div>
      {variant === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
      ) : null}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-20" />
        ))}
      </div>
    </div>
  );
}
