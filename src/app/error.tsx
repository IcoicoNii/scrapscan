"use client";

import { ErrorState } from "@/components/error-state";

export default function RootError(props: { error: unknown; retry: () => void }) {
  return (
    <main id="main" className="min-h-dvh bg-ivory">
      <ErrorState {...props} />
    </main>
  );
}
