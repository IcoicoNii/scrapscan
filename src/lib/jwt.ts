import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./rbac";

export type SessionClaims = { sub: string; role: Role };

// Collectors stay signed in long enough to sync after a day without signal.
export const SESSION_TTL_SECONDS: Record<Role, number> = {
  CITIZEN: 60 * 60 * 24 * 7,
  COLLECTOR: 60 * 60 * 24 * 30,
  ADMIN: 60 * 60 * 24,
};

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to 32+ characters (see .env.example)");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS[claims.role]}s`)
    .sign(key());
}

export async function verifyToken(token: string): Promise<SessionClaims | null> {
  const k = key(); // throws loudly if misconfigured instead of silently logging everyone out
  try {
    const { payload } = await jwtVerify(token, k, { algorithms: ["HS256"] });
    const role = payload.role;
    if (!payload.sub || (role !== "CITIZEN" && role !== "COLLECTOR" && role !== "ADMIN")) return null;
    return { sub: payload.sub, role };
  } catch {
    return null;
  }
}
