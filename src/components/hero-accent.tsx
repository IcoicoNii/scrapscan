"use client";

import { createContext, useContext, useState } from "react";

export type HeroAccent = { from: string; to: string };

const HeroAccentContext = createContext<{ setIndex: (i: number) => void } | null>(null);

/** Called by the carousel so the hero's colour follows the slide on screen. */
export function useSetHeroAccent() {
  return useContext(HeroAccentContext)?.setIndex;
}

// Parked far off-screen until the pointer enters the hero, so no dots light up before then.
const PARKED = "-1000px";

// The hero's green background. Each slide has its own palette, and the layers crossfade when the slide changes.
// The dot grid also lights up around the pointer.
export function HeroAccentSection({
  accents,
  className,
  children,
}: {
  accents: HeroAccent[];
  className?: string;
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);

  const track = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
  };
  const park = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--spot-x", PARKED);
    e.currentTarget.style.setProperty("--spot-y", PARKED);
  };

  return (
    <HeroAccentContext.Provider value={{ setIndex }}>
      <section
        className={`${className ?? ""} relative`}
        onPointerMove={track}
        onPointerLeave={park}
        style={{ ["--spot-x" as string]: PARKED, ["--spot-y" as string]: PARKED }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          {accents.map((a, i) => (
            <div
              key={i}
              className="absolute inset-0 transition-opacity duration-700 ease-in-out"
              style={{
                opacity: i === index ? 1 : 0,
                background: `radial-gradient(120% 90% at 100% 0%, rgb(255 255 255 / 0.16), transparent 55%), linear-gradient(160deg, ${a.from} 0%, ${a.to} 100%)`,
              }}
            />
          ))}
        </div>
        {/* Lime copy of the dot grid, shown only inside a circle that follows the pointer. Same grid as the
            base dots (18px, from the surface-forest class), so the lit dots sit exactly on top of them. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-[1]"
          style={{
            backgroundImage: "radial-gradient(rgb(135 233 37) 1.8px, transparent 2.2px)",
            backgroundSize: "18px 18px",
            maskImage: "radial-gradient(circle 300px at var(--spot-x) var(--spot-y), #000 0%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(circle 300px at var(--spot-x) var(--spot-y), #000 0%, transparent 100%)",
          }}
        />
        {children}
      </section>
    </HeroAccentContext.Provider>
  );
}
