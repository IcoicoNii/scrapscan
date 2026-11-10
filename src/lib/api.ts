import "server-only";
import { ForbiddenError, requirePermission } from "./auth";
import type { Permission } from "./rbac";

const noStore = { "Cache-Control": "no-store" };

export const jsonResponse = (body: unknown, status: number) => Response.json(body, { status, headers: noStore });

/** The signed-in account if it has `permission`, otherwise a ready 401/403 Response. */
export async function authorize(permission: Permission) {
  try {
    return await requirePermission(permission);
  } catch (e) {
    if (!(e instanceof ForbiddenError)) throw e;
    const signedOut = e.message === "UNAUTHENTICATED";
    return jsonResponse({ ok: false, error: signedOut ? "UNAUTHENTICATED" : "FORBIDDEN" }, signedOut ? 401 : 403);
  }
}

/**
 * Shared front door for the JSON API routes: checks the permission against the signed-in account
 * (re-read from the database), then parses the body. Returns a ready error Response on failure.
 * Requiring a JSON content type also means a plain cross-site HTML form can't post to these routes.
 */
export async function authorizeJson(request: Request, permission: Permission) {
  const user = await authorize(permission);
  if (user instanceof Response) return user;

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, 415);
  }

  try {
    return { user, body: (await request.json()) as unknown };
  } catch {
    return jsonResponse({ ok: false, error: "INVALID", message: "The request body isn't valid JSON." }, 400);
  }
}
