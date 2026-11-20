"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { format } from "@/lib/i18n/config";
import { Icon } from "./icons";
import { useSetHeroAccent } from "./hero-accent";

export type CarouselSlide = { src: string; alt: string };

export type CarouselLabels = {
  label: string;
  slideOf: string; // "{n}" and "{total}" placeholders
  pause: string;
  play: string;
};

const AUTOPLAY_MS = 6000;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const reducedMotionQuery = () => window.matchMedia(REDUCED_MOTION);
function subscribeReducedMotion(onChange: () => void) {
  const mq = reducedMotionQuery();
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// Coverflow carousel: the active slide is large and flat, and only its immediate neighbours peek in, tilted and smaller.
// Scroll-snap does the moving, so swiping, trackpads and arrow keys (once the track is focused) work without JS.
// Click a visible neighbour to move to it. Autoplay pauses on hover or focus, can be stopped with the pause button,
// and is off for reduced motion.
export function LandingCarousel({
  slides,
  labels,
  tone = "light",
}: {
  slides: CarouselSlide[];
  labels: CarouselLabels;
  tone?: "light" | "dark";
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(true);
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, () => reducedMotionQuery().matches, () => false);
  const count = slides.length;
  const dark = tone === "dark";
  const setHeroIndex = useSetHeroAccent();
  useEffect(() => {
    setHeroIndex?.(index);
  }, [index, setHeroIndex]);

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track) return;
      const next = (i + count) % count;
      const slide = track.children[next] as HTMLElement | undefined;
      if (!slide) return;
      // Centre the slide: its offset minus the empty space on either side of it.
      const left = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
      track.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
      setIndex(next);
    },
    [count, reduceMotion],
  );

  // Follow manual swiping: the slide closest to the centre of the track becomes active.
  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const centre = track.scrollLeft + track.clientWidth / 2;
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centre);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    setIndex(nearest);
  };

  const autoplay = playing && !hovered && !reduceMotion && count > 1;
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => goTo(index + 1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [autoplay, goTo, index]);

  const pauseBtn = dark
    ? "absolute right-3 top-3 z-40 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white ring-1 ring-inset ring-white/30 backdrop-blur transition hover:bg-white/25"
    : "absolute right-3 top-3 z-40 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-forest ring-1 ring-inset ring-line backdrop-blur transition hover:bg-white";

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.label}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(false);
      }}
    >
      {/* Padding centres the first and last slide, so the neighbour on each side is the only one visible. */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label={labels.label}
        style={{ perspective: "1200px" }}
        className="flex snap-x snap-mandatory items-center gap-4 overflow-x-auto scroll-smooth px-[15%] py-20 [scrollbar-width:none] sm:px-[17%] sm:py-24[&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => {
          const offset = i - index;
          const d = Math.abs(offset);
          const active = d === 0;
          // The active slide is enlarged so it overlaps its neighbours. Slides that move to the side return to
          // their original size and tilt towards the centre. Anything further out is hidden.
          const tilt = active ? 0 : offset < 0 ? 14 : -14;
          const scale = active ? 1.34 : 1;
          return (
            <div
              key={s.src}
              role="group"
              aria-roledescription="slide"
              aria-label={format(labels.slideOf, { n: i + 1, total: count })}
              aria-current={active ? "true" : undefined}
              onClick={active ? undefined : () => goTo(i)}
              style={{
                transform: `rotateY(${tilt}deg) scale(${scale})`,
                opacity: active ? 1 : 0.8,
                // The active slide sits above both neighbours, so it covers them where it overlaps.
                zIndex: active ? 30 : 10,
              }}
              className={`relative aspect-video w-[70%] shrink-0 snap-center overflow-hidden rounded-2xl bg-white shadow-pop transition-[transform,opacity] duration-500 ease-out sm:w-[66%] ${
                active ? "" : "cursor-pointer"
              }`}
            >
              <Image
                src={s.src}
                alt={s.alt}
                fill
                sizes="(min-width: 640px) 760px, 70vw"
                priority={i === 0}
                className="object-cover"
              />
            </div>
          );
        })}
      </div>

      {/* Soft shadow the carousel casts onto the surface beneath it. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none mx-auto -mt-12 h-14 w-[64%] rounded-[50%] blur-2xl ${
          dark ? "bg-black/60" : "bg-khaki/30"
        }`}
      />

      {count > 1 && (
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? labels.pause : labels.play}
          aria-pressed={!playing}
          className={pauseBtn}
        >
          <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}
