import { Icon } from "./icons";

type Result = "CORRECT" | "CONTAMINATED";

// Icon + words, never color alone.
export function BinChips({ bins }: { bins: { biodegradable: Result; recyclable: Result; residual: Result } }) {
  const rows: [string, Result][] = [
    ["Biodegradable", bins.biodegradable],
    ["Recyclable", bins.recyclable],
    ["Residual", bins.residual],
  ];
  return (
    <ul className="flex flex-wrap gap-2">
      {rows.map(([label, r]) => (
        <li
          key={label}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${
            r === "CORRECT" ? "bg-mint text-forest ring-forest/15" : "bg-danger-soft text-danger ring-danger/20"
          }`}
        >
          <Icon name={r === "CORRECT" ? "check" : "warn"} className="h-4 w-4" />
          {label}: {r === "CORRECT" ? "Correct" : "Contaminated"}
        </li>
      ))}
    </ul>
  );
}

/** Single result for table cells. Icon + word, same as the chips. */
export function BinResultLabel({ result }: { result: Result }) {
  const ok = result === "CORRECT";
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${ok ? "text-forest" : "text-danger"}`}>
      <Icon name={ok ? "check" : "warn"} className="h-4 w-4" />
      {ok ? "Correct" : "Contaminated"}
    </span>
  );
}
