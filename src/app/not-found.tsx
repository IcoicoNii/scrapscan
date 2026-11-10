import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" className="on-light grid min-h-dvh place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <BrandMark className="mx-auto h-16 w-16 text-forest" />
        <p className="mt-6 bg-linear-to-b from-forest to-moss bg-clip-text text-8xl font-extrabold tracking-tight text-transparent">404</p>
        <h1 className="mt-2 text-2xl font-extrabold">This page doesn’t exist</h1>
        <p className="mt-2 text-slate-green">The link may be old or mistyped. Head back home and try again from there.</p>
        <Link href="/" className="btn btn-primary mt-8 w-full sm:w-auto">
          Go to ScrapScan home
        </Link>
      </div>
    </main>
  );
}
