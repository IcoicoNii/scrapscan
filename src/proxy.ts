import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { AREA_ROLE, homeFor } from "@/lib/rbac";

// Coarse gate only. Every page, action and route handler still re-checks on the server.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("ss_session")?.value;
  const session = token ? await verifyToken(token) : null;

  const area = Object.keys(AREA_ROLE).find((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (area) {
    if (!session) {
      const url = new URL("/login", request.url);
      return NextResponse.redirect(url);
    }
    if (session.role !== AREA_ROLE[area]) {
      return NextResponse.redirect(new URL(homeFor(session.role), request.url));
    }
    return NextResponse.next();
  }

  // /login and /register are NOT handled here: a valid cookie can belong to a deactivated account,
  // and only the database knows. Those pages redirect signed-in users themselves (see login/page.tsx).
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/collector/:path*", "/citizen/:path*"],
};
