import { describe, expect, it, vi } from "vitest";
import {
  getAuthAccess,
  getAuthRedirect,
  type AuthAccess,
} from "@/lib/auth/access";
import type { Database } from "@/lib/supabase/database.types";

function createSupabaseClient({
  userId,
  hasMembership,
  membershipError = null,
}: {
  userId?: string;
  hasMembership?: boolean;
  membershipError?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: hasMembership ? { id: "membership-1" } : null,
    error: membershipError,
  });
  const query = {
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle,
  };

  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: userId ? { sub: userId } : null },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(query),
    }),
  } as unknown as Parameters<typeof getAuthAccess>[0] & {
    __database?: Database;
  };
}

describe("getAuthAccess", () => {
  it("treats missing verified claims as unauthenticated", async () => {
    const access = await getAuthAccess(createSupabaseClient({}));

    expect(access).toEqual({ kind: "unauthenticated" });
  });

  it("recognizes an active membership returned through RLS", async () => {
    const access = await getAuthAccess(
      createSupabaseClient({ userId: "user-1", hasMembership: true }),
    );

    expect(access).toEqual({ kind: "active-member", userId: "user-1" });
  });

  it("fails closed when no active membership is available", async () => {
    const access = await getAuthAccess(
      createSupabaseClient({ userId: "user-1", hasMembership: false }),
    );

    expect(access).toEqual({ kind: "no-access", userId: "user-1" });
  });

  it("fails closed when the membership query fails", async () => {
    const access = await getAuthAccess(
      createSupabaseClient({
        userId: "user-1",
        membershipError: new Error("Database unavailable"),
      }),
    );

    expect(access).toEqual({ kind: "no-access", userId: "user-1" });
  });
});

describe("getAuthRedirect", () => {
  const activeMember: AuthAccess = { kind: "active-member", userId: "user-1" };
  const noAccess: AuthAccess = { kind: "no-access", userId: "user-1" };
  const unauthenticated: AuthAccess = { kind: "unauthenticated" };

  it.each([
    ["/", unauthenticated, "/login"],
    ["/no-access", unauthenticated, "/login"],
    ["/login", unauthenticated, null],
    ["/login", activeMember, "/"],
    ["/no-access", activeMember, "/"],
    ["/", noAccess, "/no-access"],
    ["/login", noAccess, "/no-access"],
    ["/no-access", noAccess, null],
    ["/auth/confirm", unauthenticated, null],
    ["/auth/sign-out", noAccess, null],
  ])("routes %s for %o", (pathname, access, expected) => {
    expect(getAuthRedirect(pathname, access)).toBe(expected);
  });
});
