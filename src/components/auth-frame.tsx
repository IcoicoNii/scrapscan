import Link from "next/link";
import { BrandMark, Wordmark } from "./brand";
import { Icon } from "./icons";

const points = [
  "Sort your waste into three bins at home",
  "Your collector scans your household QR code",
  "Earn points and trade them for rewards",
];

// Phones: the screen itself is full-bleed. Tablets: a centered card. Desktop: brand panel + card.
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="min-h-dvh bg-white md:bg-transparent lg:grid lg:grid-cols-2">
      <aside className="surface-forest sticky top-0 hidden h-dvh flex-col justify-between p-12 lg:flex">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold hover:underline">
          <Icon name="arrow-left" className="h-5 w-5" />
          Back to home
        </Link>
        <div>
          <span className="grid h-24 w-24 place-items-center rounded-[1.75rem] bg-white/10 ring-1 ring-inset ring-white/15 shadow-lift">
            <BrandMark className="h-14 w-14 text-lawn" />
          </span>
          <p className="mt-6">
            <Wordmark className="text-5xl" />
          </p>
          <p className="mt-4 max-w-md text-lg text-white/90">A community-driven QR-based waste segregation and rewards system</p>
          <ul className="mt-10 max-w-md space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-inset ring-white/10">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lawn text-khaki">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-mint">Barangay waste segregation pilot</p>
      </aside>
      <div className="md:grid md:min-h-dvh md:place-items-center md:p-6 lg:p-10">{children}</div>
    </main>
  );
}
