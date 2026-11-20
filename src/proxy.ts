import { clerkMiddleware } from "@clerk/nextjs/server";

// Makes Clerk's session available to every request (auth() needs this). It does not decide access:
// each protected layout, page and action checks the signed-in user itself (requireRole, requirePermission).
export default clerkMiddleware();

export const config = {
  // Clerk must run on every page that reads the user (including /login, /register and /),
  // not only the app areas, and skips static assets.
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
