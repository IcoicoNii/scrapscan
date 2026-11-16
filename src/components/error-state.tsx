"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "./icons";
import { useI18n } from "./i18n";
import { format } from "@/lib/i18n/config";

// Shared fallback for every error.tsx boundary. Server errors arrive with only a digest
// (no message) in production, so we never show error text, just the reference.
export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <div className="on-light mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-danger-soft text-danger ring-1 ring-inset ring-danger/15">
        <Icon name="warn" className="h-8 w-8" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">{t.error.title}</h1>
      <p className="mt-2 text-slate-green">{t.error.body}</p>
      {digest && <p className="mt-2 text-xs text-slate-green">{format(t.error.reference, { digest })}</p>}
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          {t.common.tryAgain}
        </button>
        <Link href="/" className="btn btn-secondary">
          {t.common.goHome}
        </Link>
      </div>
    </div>
  );
}
