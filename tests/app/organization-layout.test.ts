import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, requireMembershipMock, redirectMock, notFoundMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    requireMembershipMock: vi.fn(),
    redirectMock: vi.fn(),
    notFoundMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/organizations/require-membership", () => ({
  requireOrganizationMembership: requireMembershipMock,
}));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

import OrganizationLayout from "@/app/org/[organizationSlug]/layout";

beforeEach(() => {
  createClientMock.mockReset().mockResolvedValue({});
  requireMembershipMock.mockReset();
  redirectMock.mockReset().mockImplementation((path: string) => {
    throw new Error(`redirect:${path}`);
  });
  notFoundMock.mockReset().mockImplementation(() => {
    throw new Error("not-found");
  });
});

describe("organization route authorization", () => {
  it("renders the shell for an active member", async () => {
    requireMembershipMock.mockResolvedValue({
      kind: "authorized",
      context: {
        organization: {
          id: "organization-1",
          name: "Operations",
          slug: "operations",
        },
      },
    });

    const element = await OrganizationLayout({
      children: "runner",
      params: Promise.resolve({ organizationSlug: "operations" }),
    });

    expect(requireMembershipMock).toHaveBeenCalledWith(
      expect.anything(),
      "operations",
    );
    expect(element.props).toMatchObject({
      organizationName: "Operations",
      organizationSlug: "operations",
      children: "runner",
    });
  });

  it("redirects an unauthenticated visitor to login", async () => {
    requireMembershipMock.mockResolvedValue({ kind: "unauthenticated" });

    await expect(
      OrganizationLayout({
        children: "runner",
        params: Promise.resolve({ organizationSlug: "operations" }),
      }),
    ).rejects.toThrow("redirect:/login");
  });

  it.each(["non-member", "inactive member", "unknown organization"])(
    "returns the same not-found result for a %s",
    async () => {
      requireMembershipMock.mockResolvedValue({ kind: "not-found" });

      await expect(
        OrganizationLayout({
          children: "runner",
          params: Promise.resolve({ organizationSlug: "private" }),
        }),
      ).rejects.toThrow("not-found");
    },
  );
});
