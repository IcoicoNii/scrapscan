// Test stand-in for Clerk. Tests replace "@clerk/nextjs/server" with `clerkModule` (vi.mock), so the
// app's auth() and clerkClient() calls work without Clerk's network service or a Next.js request.
// Passwords and bans are kept in memory so tests can check them.

type FakeLogin = { id: string; email?: string; password?: string; banned: boolean };

const logins = new Map<string, FakeLogin>();
let current: string | null = null;

const loginFor = (id: string): FakeLogin => {
  let login = logins.get(id);
  if (!login) {
    login = { id, banned: false };
    logins.set(id, login);
  }
  return login;
};

/** The Clerk user the next request is made as (null = signed out). */
export function setCurrentClerkUser(id: string | null) {
  current = id;
}

export function fakeLogin(id: string): FakeLogin | undefined {
  return logins.get(id);
}

/** Signs in as an app user: gives the account a Clerk id if it has none, then makes that the current login. */
export async function asUser(userId: string) {
  const { db } = await import("@/lib/db");
  const row = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { clerkId: true } });
  const clerkId = row.clerkId ?? `user_test_${userId}`;
  if (!row.clerkId) await db.user.update({ where: { id: userId }, data: { clerkId } });
  loginFor(clerkId);
  current = clerkId;
  return clerkId;
}

export const fakeClerk = {
  users: {
    createUser: async (p: { emailAddress?: string[]; password?: string }) => {
      const id = `user_test_${Math.random().toString(36).slice(2, 12)}`;
      logins.set(id, { id, email: p.emailAddress?.[0], password: p.password, banned: false });
      return { id };
    },
    updateUser: async (id: string, p: { password?: string }) => {
      const login = loginFor(id);
      if (p.password !== undefined) login.password = p.password;
      return { id };
    },
    deleteUser: async (id: string) => {
      logins.delete(id);
      return { id };
    },
    verifyPassword: async ({ userId, password }: { userId: string; password: string }) => {
      if (loginFor(userId).password !== password) throw new Error("Incorrect password");
      return { verified: true };
    },
    banUser: async (id: string) => {
      loginFor(id).banned = true;
      return { id };
    },
    unbanUser: async (id: string) => {
      loginFor(id).banned = false;
      return { id };
    },
    getUser: async (id: string) => ({ id, primaryEmailAddress: null, primaryPhoneNumber: null }),
  },
  sessions: {
    getSessionList: async () => ({ data: [] }),
    revokeSession: async (id: string) => ({ id }),
  },
};

export const clerkModule = {
  auth: async () => ({ userId: current }),
  clerkClient: async () => fakeClerk,
};
