import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";

export const metadata: Metadata = { title: "Forgot password" };

// Emailing reset links needs an email service we haven't set up. Until then this page says
// so plainly instead of showing a form that does nothing.
export default function ForgotPasswordPage() {
  return (
    <AuthFrame>
      <div className="on-light mx-auto w-full max-w-md bg-white px-6 py-14 sm:px-8 text-center text-slate-green md:rounded-[2rem] md:shadow-pop">
        <span className="icon-tile mx-auto h-20 w-20 rounded-[1.5rem]">
        <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true" fill="currentColor">
          <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm-3 8V6a3 3 0 1 1 6 0v3H9Zm3 4a1.6 1.6 0 0 1 .8 3v2.2h-1.6V16a1.6 1.6 0 0 1 .8-3Z" />
        </svg>
        </span>
        <h1 className="mt-6 text-3xl tracking-tight text-khaki">
          <span className="block font-extrabold">Forgot</span>
          <span className="block font-light">password?</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xs text-base leading-relaxed">
          Password reset by email isn’t available yet. Ask your barangay admin to reset it for you, then log in with
          the new password.
        </p>
        <Link href="/login" className="btn btn-primary mt-10 w-full">
          Back to log in
        </Link>
      </div>
    </AuthFrame>
  );
}
