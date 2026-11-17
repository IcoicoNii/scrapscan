import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { BrandMark } from "@/components/brand";
import { Icon, type IconName } from "@/components/icons";
import { PublicShell } from "@/components/public-shell";
import Image from "next/image";
import { LandingCarousel, type CarouselSlide } from "@/components/landing-carousel";
import { HeroAccentSection, type HeroAccent } from "@/components/hero-accent";
import { getI18n } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/en";

// The hero's background palette for each carousel slide, sampled by eye from the campaign images.
// The banner (slide 1) is shown below the carousel instead, so the carousel starts at slide 2.
const HERO_ACCENTS: HeroAccent[] = [
  { from: "#1f6e44", to: "#0c3a24" }, // 2 SDG: forest green
  { from: "#0d7a7a", to: "#063f40" }, // 3 reward: teal
  { from: "#0f7a4a", to: "#073d25" }, // 4 types of waste: emerald
  { from: "#2f7d6b", to: "#123d35" }, // 5 rethink consumption: sage
  { from: "#6b7f1a", to: "#323d09" }, // 6 be part of the change: olive moss
  { from: "#2d6268", to: "#14363b" }, // 7 why trash matters: slate teal
  { from: "#4b8f22", to: "#22470f" }, // 8 global waste: lime green
  { from: "#1c5c60", to: "#0a3134" }, // 9 community actions: deep teal
  { from: "#7a7418", to: "#3d3a0a" }, // 10 how can you help: olive gold
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { t } = await getI18n();
  const l = t.landing;
  const steps: { icon: IconName; title: string; body: string }[] = [
    { icon: "recycle", title: l.step1Title, body: l.step1Body },
    { icon: "qr", title: l.step2Title, body: l.step2Body },
    { icon: "gift", title: l.step3Title, body: l.step3Body },
  ];
  // Mirrors src/lib/scoring.ts. Display only; the server is the one that scores.
  const scoring = [
    { contaminated: l.none, points: 10 },
    { contaminated: l.one, points: 5 },
    { contaminated: l.many, points: 0 },
  ];
  const audiences: { icon: IconName; title: string; body: string }[] = [
    { icon: "home", title: l.residents, body: l.residentsBody },
    { icon: "qr", title: l.collectors, body: l.collectorsBody },
    { icon: "chart", title: l.barangay, body: l.barangayBody },
  ];
  // The campaign visuals live in public/landing/ as slide-01.png … slide-10.png, in display order.
  // Slide 1 is the banner, shown full width below the carousel. The carousel takes slides 2–10.
  const slideSrc = (i: number) => `/landing/slide-${String(i + 1).padStart(2, "0")}.png`;
  const slides: CarouselSlide[] = l.carouselAlts.slice(1).map((alt, i) => ({ src: slideSrc(i + 1), alt }));
  const carouselLabels = {
    label: l.carouselLabel,
    slideOf: l.carouselSlideOf,
    pause: l.carouselPause,
    play: l.carouselPlay,
  };

  return (
    <PublicShell>
      <HeroAccentSection accents={HERO_ACCENTS} className="surface-forest">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-12 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-lawn ring-1 ring-inset ring-white/15">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-lawn" />
              {l.badge}
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              {l.title1}
              <span className="block font-light text-mint">{l.title2}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/90">
              {l.intro}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn btn-lawn">
                {l.create}
                <Icon name="chevron-right" className="h-5 w-5" />
              </Link>
              <Link href="/login" className="btn btn-glass">
                {t.common.logIn}
              </Link>
            </div>
            <p className="mt-4 text-sm text-mint">{l.signUpNote}</p>
          </div>
          <HeroPreview t={t} />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 md:pb-28">
          <div className="mt-6 min-w-0 md:mt-10">
            <LandingCarousel slides={slides} labels={carouselLabels} tone="dark" />
          </div>
        </div>
      </HeroAccentSection>

      <section aria-label={l.carouselAlts[0]} className="mx-auto max-w-6xl px-4 pt-14 sm:px-6 md:pt-20">
        <figure>
          <Image
            src={slideSrc(0)}
            alt={l.carouselAlts[0]}
            width={1200}
            height={300}
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="h-auto w-full shadow-pop"
          />
        </figure>
      </section>

      <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
        <p className="text-sm font-bold uppercase tracking-wider text-forest">{l.stepsEyebrow}</p>
        <h2 id="how" className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
          {l.stepsTitle}
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="card-link card relative overflow-hidden">
              <span aria-hidden="true" className="absolute right-5 top-3 text-6xl font-extrabold leading-none text-mint">
                {i + 1}
              </span>
              <div className="relative flex items-center gap-3">
                <span className="icon-tile h-12 w-12">
                  <Icon name={s.icon} className="h-6 w-6" />
                </span>
                <span className="text-sm font-bold text-slate-green">{format(l.step, { n: i + 1 })}</span>
              </div>
              <h3 className="relative mt-4 text-lg font-bold">{s.title}</h3>
              <p className="relative mt-1 text-slate-green">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="points" className="surface-forest border-y border-white/10">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <h2 id="points" className="text-3xl font-extrabold tracking-tight md:text-4xl">
              {l.pointsTitle}
            </h2>
            <p className="mt-3 text-white/90">
              {l.pointsBody}
            </p>
          </div>
          <div className="table-wrap text-black">
            <table className="data-table">
              <caption className="sr-only">{l.pointsCaption}</caption>
              <thead>
                <tr>
                  <th scope="col" className="px-5 py-3">{l.result}</th>
                  <th scope="col" className="px-5 py-3 text-right">{l.points}</th>
                </tr>
              </thead>
              <tbody>
                {scoring.map((r) => (
                  <tr key={r.points}>
                    <th scope="row" className="px-5 py-4 font-semibold">{r.contaminated}</th>
                    <td className="px-5 py-4 text-right text-xl font-extrabold tabular-nums text-forest">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="who" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
        <h2 id="who" className="text-3xl font-extrabold tracking-tight md:text-4xl">
          {l.whoTitle}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((a) => (
            <li key={a.title} className="card-link card">
              <span className="icon-tile h-12 w-12">
                <Icon name={a.icon} className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{a.title}</h3>
              <p className="mt-1 text-slate-green">{a.body}</p>
            </li>
          ))}
        </ul>
        <div className="surface-forest mt-12 rounded-[1.75rem] p-6 shadow-lift sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-10">
          <div>
            <p className="text-2xl font-extrabold tracking-tight">{l.ctaTitle}</p>
            <p className="mt-1 text-mint">{l.ctaBody}</p>
          </div>
          <Link href="/register" className="btn btn-lawn mt-4 w-full sm:mt-0 sm:w-auto">
            {l.ctaButton}
          </Link>
        </div>
      </section>

      <section aria-label={`${l.missionTitle} · ${l.visionTitle}`} className="mx-auto grid max-w-6xl gap-4 px-4 pb-14 sm:px-6 md:grid-cols-2 md:pb-20">
        <article className="card-link card">
          <span className="icon-tile h-12 w-12">
            <Icon name="flag" className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-xl font-bold">{l.missionTitle}</h2>
          <p className="mt-2 text-slate-green">{l.missionBody}</p>
        </article>
        <article className="card-link card">
          <span className="icon-tile h-12 w-12">
            <Icon name="leaf" className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-xl font-bold">{l.visionTitle}</h2>
          <p className="mt-2 text-slate-green">{l.visionBody}</p>
        </article>
      </section>
    </PublicShell>
  );
}

// Decorative glimpse of the resident dashboard. Hidden from assistive tech; the copy beside it says the same thing.
function HeroPreview({ t }: { t: Dictionary }) {
  const bins = [t.bins.biodegradable, t.bins.recyclable, t.bins.residual];
  return (
    <div aria-hidden="true" className="relative mx-auto hidden w-full max-w-sm md:block">
      <div className="absolute -inset-8 rounded-full bg-lawn/25 blur-3xl" />
      <div className="relative -rotate-2 rounded-[1.75rem] bg-white/10 p-6 pb-10 shadow-pop ring-1 ring-inset ring-white/20 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-mint">{t.landing.previewPoints}</p>
          <BrandMark className="h-7 w-7 text-lawn" />
        </div>
        <p className="mt-1 text-5xl font-extrabold tracking-tight tabular-nums">
          240 <span className="text-xl font-semibold text-lawn">pts</span>
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-4/5 rounded-full bg-lawn" />
        </div>
        <p className="mt-2 text-xs text-white/80">{t.landing.previewNext}</p>
      </div>
      <div className="relative -mt-5 ml-10 rotate-[1.5deg] rounded-2xl bg-white p-4 text-khaki shadow-pop">
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold">{t.landing.previewToday}</span>
          <span className="text-lg font-extrabold text-forest">+10 pts</span>
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {bins.map((b) => (
            <li key={b} className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-forest">
              <Icon name="check" className="h-3.5 w-3.5" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
