"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { plural } from "@/lib/i18n/config";
import { useI18n } from "./i18n";

// Log out button. Ends the Clerk session, then goes to the login screen.
// With `offlineData` (collector pages), it first warns about unsent scans and then clears what must not
// outlive the session on this phone (household list, saved pages). Unsent scans themselves are kept: they
// belong to this collector and send after their next sign-in.
export function LogoutForm({
  offlineData = false,
  children,
  onClick,
  ...button
}: { offlineData?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { signOut } = useClerk();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      {...button}
      disabled={busy || button.disabled}
      onClick={async (e) => {
        onClick?.(e);
        if (busy) return;
        if (offlineData) {
          const { syncStatus, clearOnLogout } = await import("@/lib/offline/queue");
          const { pending, attention } = syncStatus.get();
          const unsent = pending + attention;
          if (unsent > 0 && !window.confirm(plural(unsent, t.collector.logoutUnsentOne, t.collector.logoutUnsentOther))) {
            return;
          }
          await clearOnLogout();
        }
        setBusy(true);
        await signOut({ redirectUrl: "/login" });
      }}
    >
      {children}
    </button>
  );
}
