"use client";

import { useRef } from "react";
import { logoutAction } from "@/app/actions/auth";

// Log out button. With `offlineData` (collector pages), it first warns about unsent scans and then
// clears what must not outlive the session on this phone (household list, saved pages). Unsent scans
// themselves are kept: they belong to this collector and send after their next sign-in.
export function LogoutForm({
  offlineData = false,
  children,
  ...button
}: { offlineData?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const confirmed = useRef(false);

  return (
    <form
      action={logoutAction}
      onSubmit={(e) => {
        if (!offlineData || confirmed.current) return;
        e.preventDefault();
        const form = e.currentTarget;
        (async () => {
          const { syncStatus, clearOnLogout } = await import("@/lib/offline/queue");
          const { pending, attention } = syncStatus.get();
          const unsent = pending + attention;
          if (
            unsent > 0 &&
            !window.confirm(
              `${unsent} ${unsent === 1 ? "scan hasn’t" : "scans haven’t"} been sent yet. ` +
                "They stay saved on this phone and will send the next time you sign in. Log out anyway?",
            )
          ) {
            return;
          }
          await clearOnLogout();
          confirmed.current = true;
          form.requestSubmit();
        })();
      }}
    >
      <button {...button}>{children}</button>
    </form>
  );
}
