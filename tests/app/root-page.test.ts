import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, getFirstMembershipMock, redirectMock } = vi.hoisted(
  () => ({
    createClientMock: vi.fn(),
    getFirstMembershipMock: vi.fn(),
    redirectMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/organizations/get-first-membership", () => ({
  getFirstActiveMembership: getFirstMembershipMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import HomePage from "@/app/page";

beforeEach(() => {
  createClientMock.mockReset().mockResolvedValue({});
  getFirstMembershipMock.mockReset();
  redirectMock.mockReset().mockImplementation((path: string) => {
    throw new Error(`redirect:${path}`);
  });
});

describe("root organization resolution", () => {
  it("redirects an unauthenticated user to login", async () => {
    getFirstMembershipMock.mockResolvedValue({ kind: "unauthenticated" });

    await expect(HomePage()).rejects.toThrow("redirect:/login");
  });

  it("redirects an authenticated user without membership to no-access", async () => {
    getFirstMembershipMock.mockResolvedValue({
      kind: "no-access",
      userId: "user-1",
    });

    await expect(HomePage()).rejects.toThrow("redirect:/no-access");
  });

  it("redirects an active member to the first organization requests workspace", async () => {
    getFirstMembershipMock.mockResolvedValue({
      kind: "active-member",
      context: {
        organization: { slug: "ops workspace" },
      },
    });

    await expect(HomePage()).rejects.toThrow(
      "redirect:/org/ops%20workspace/requests",
    );
  });
});
