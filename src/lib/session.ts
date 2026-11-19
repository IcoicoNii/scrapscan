import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { SESSION_TTL_SECONDS, signToken, verifyToken, type SessionClaims } from "./jwt";
import type { Role } from "./rbac";

export const SESSION_COOKIE = "ss_session";

export async function createSession(userId: string, role: Role) {
  const { sessionVersion } = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
  const token = await signToken({ sub: userId, role, sv: sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS[role],
  });
}

export async function readSession(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}
