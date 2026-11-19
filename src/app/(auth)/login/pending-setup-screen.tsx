"use client";

import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";

// Shown when someone is signed in to Clerk but has no active account. Nothing is created here:
// the account only exists once the household is registered or joined on the claim page.
export function PendingSetupScreen({ inactive }: { inactive: boolean }) {
  return (
    <AuthFrame>
      <div className="surface-forest mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center md:min-h-0 md:rounded-[2rem] md:shadow-pop">
        <h1 className="text-3xl font-extrabold">{inactive ? "Account not active" : "Finish setting up"}</h1>
        <p className="mt-4 max-w-sm text-base leading-snug">
          {inactive
            ? "This account isn’t active right now. Ask the barangay office for help."
            : "You’re signed in, but your household isn’t registered yet. Your account is created once you finish the household step."}
        </p>
        <div className="mt-8 w-full space-y-3">
          {!inactive && (
            <Link href="/register/claim" className="btn btn-primary w-full">
              Finish setup
            </Link>
          )}
          <SignOutButton redirectUrl="/login">
            <button type="button" className="btn btn-secondary w-full">
              Use a different account
            </button>
          </SignOutButton>
        </div>
      </div>
    </AuthFrame>
  );
}
