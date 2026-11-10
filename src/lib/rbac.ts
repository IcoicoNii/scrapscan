// Pure module (no server-only imports) so proxy.ts, server code and tests can share it.
export type Role = "CITIZEN" | "COLLECTOR" | "ADMIN";

export const PERMISSIONS = {
  CITIZEN: [
    "household:read:own",
    "qr:read:own",
    "points:read:own",
    "collection:read:own",
    "reward:read",
    "redemption:create:own",
  ],
  COLLECTOR: ["household:lookup", "collection:create", "collection:read:own"],
  // Admins can NOT create collections: that keeps the "who scanned" trail honest.
  // They correct mistakes with a reversal ledger row (points:reverse), never by editing.
  ADMIN: [
    "household:read:all",
    "household:create",
    "household:update",
    "qr:revoke",
    "qr:reissue",
    "collection:read:all",
    "points:read:all",
    "points:reverse",
    "reward:read",
    "reward:manage",
    "redemption:approve",
    "analytics:read",
    "user:manage",
    "audit:read",
  ],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof PERMISSIONS)[Role][number];

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[role] as readonly string[]).includes(permission);
}

export const HOME_BY_ROLE: Record<Role, string> = {
  CITIZEN: "/citizen",
  COLLECTOR: "/collector",
  ADMIN: "/admin",
};

export const homeFor = (role: Role) => HOME_BY_ROLE[role];

export const AREA_ROLE: Record<string, Role> = {
  "/citizen": "CITIZEN",
  "/collector": "COLLECTOR",
  "/admin": "ADMIN",
};
