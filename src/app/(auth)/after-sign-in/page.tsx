import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";

// Where Clerk sends everyone after sign-in or sign-up. Decides where they belong.
export default async function AfterSignInPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  // Signed in to Clerk but no account row yet: finish sign-up with the household claim code.
  // (A deactivated account also lands here; it has no active account, so it goes back to log in.)
  const { userId } = await auth();
  redirect(userId ? "/register/claim" : "/login");
}
