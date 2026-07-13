import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFirstActiveMembershipMock } = vi.hoisted(() => ({
  getFirstActiveMembershipMock: vi.fn(),
}));

vi.mock("@/lib/organizations/get-first-membership", () => ({
  getFirstActiveMembership: getFirstActiveMembershipMock,
}));

import {
  getAuthAccess,
  getAuthRedirect,
  type AuthAccess,
} from "@/lib/auth/access";

beforeEach(() => {
  getFirstActiveMembershipMock.mockReset();
});

describe("getAuthAccess", () => {
  it("treats missing verified claims as unauthenticated", async () => {
    getFirstActiveMembershipMock.mockResolvedValue({
      kind: "unauthenticated",
    });

    const access = await getAuthAccess({} as Parameters<typeof getAuthAccess>[0]);

    expect(access).toEqual({ kind: "unauthenticated" });
  });

  it("includes the first active organization slug", async () => {
    getFirstActiveMembershipMock.mockResolvedValue({
      kind: "active-member",
      context: {
        userId: "user-1",
        organization: { slug: "ops-workspace" },
      },
    });

    const access = await getAuthAccess({} as Parameters<typeof getAuthAccess>[0]);

    expect(access).toEqual({
      kind: "active-member",
      userId: "user-1",
      organizationSlug: "ops-workspace",
    });
  });

  it("fails closed when no active membership is available", async () => {
    getFirstActiveMembershipMock.mockResolvedValue({
      kind: "no-access",
      userId: "user-1",
    });

    const access = await getAuthAccess({} as Parameters<typeof getAuthAccess>[0]);

    expect(access).toEqual({ kind: "no-access", userId: "user-1" });
  });
});

describe("getAuthRedirect", () => {
  const activeMember: AuthAccess = {
    kind: "active-member",
    userId: "user-1",
    organizationSlug: "ops workspace",
  };
  const noAccess: AuthAccess = { kind: "no-access", userId: "user-1" };
  const unauthenticated: AuthAccess = { kind: "unauthenticated" };

  it.each([
    ["/", unauthenticated, "/login"],
    ["/no-access", unauthenticated, "/login"],
    ["/login", unauthenticated, null],
    ["/login", activeMember, "/org/ops%20workspace/requests"],
    ["/no-access", activeMember, "/org/ops%20workspace/requests"],
    ["/", noAccess, "/no-access"],
    ["/login", noAccess, "/no-access"],
    ["/no-access", noAccess, null],
    ["/auth/confirm", unauthenticated, null],
    ["/auth/sign-out", noAccess, null],
  ])("routes %s for %o", (pathname, access, expected) => {
    expect(getAuthRedirect(pathname, access)).toBe(expected);
  });
});
