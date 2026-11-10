"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "./icons";

// Shared fallback for every error.tsx boundary. Server errors arrive with only a digest
// (no message) in production, so we never show error text, just the reference.
export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <div className="on-light mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-danger-soft text-danger ring-1 ring-inset ring-danger/15">
        <Icon name="warn" className="h-8 w-8" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-slate-green">
        This page couldn’t load. Check your connection and try again. If it keeps happening, tell your barangay admin.
      </p>
      {digest && <p className="mt-2 text-xs text-slate-green">Reference: {digest}</p>}
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Go home
        </Link>
      </div>
    </div>
  );
}
