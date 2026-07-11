import { describe, expect, it, vi } from "vitest";
import { getFirstActiveMembership } from "@/lib/organizations/get-first-membership";
import { requireOrganizationMembership } from "@/lib/organizations/require-membership";

type QueryResult = { data: unknown; error: unknown };

function createQuery(result: QueryResult) {
  const query = {
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };

  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  return query;
}

function createSupabaseClient({
  userId = "user-1",
  organizationResults = [],
  membershipResults = [],
}: {
  userId?: string | null;
  organizationResults?: QueryResult[];
  membershipResults?: QueryResult[];
}) {
  const organizationQueries = organizationResults.map(createQuery);
  const membershipQueries = membershipResults.map(createQuery);
  let organizationIndex = 0;
  let membershipIndex = 0;

  const from = vi.fn((table: string) => {
    const query =
      table === "organizations"
        ? organizationQueries[organizationIndex++]
        : membershipQueries[membershipIndex++];

    return {
      select: vi.fn().mockReturnValue(query),
    };
  });

  return {
    client: {
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: userId ? { sub: userId } : null },
          error: null,
        }),
      },
      from,
    } as unknown as Parameters<typeof requireOrganizationMembership>[0],
    from,
    organizationQueries,
    membershipQueries,
  };
}

const organization = {
  id: "organization-1",
  name: "Operations",
  slug: "operations",
};

const membership = {
  id: "membership-1",
  organization_id: organization.id,
  role: "operator",
};

describe("requireOrganizationMembership", () => {
  it("authorizes an active member using verified identity and RLS data", async () => {
    const { client, membershipQueries } = createSupabaseClient({
      organizationResults: [{ data: organization, error: null }],
      membershipResults: [{ data: membership, error: null }],
    });

    const result = await requireOrganizationMembership(client, "operations");

    expect(result).toEqual({
      kind: "authorized",
      context: {
        userId: "user-1",
        membershipId: "membership-1",
        role: "operator",
        organization,
      },
    });
    expect(membershipQueries[0].eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(membershipQueries[0].eq).toHaveBeenCalledWith("status", "active");
  });

  it("rejects a non-member or inactive membership", async () => {
    const { client } = createSupabaseClient({
      organizationResults: [{ data: organization, error: null }],
      membershipResults: [{ data: null, error: null }],
    });

    await expect(
      requireOrganizationMembership(client, "operations"),
    ).resolves.toEqual({ kind: "not-found" });
  });

  it.each(["unknown", "cross-organization"])(
    "does not reveal an %s slug",
    async () => {
      const { client, from } = createSupabaseClient({
        organizationResults: [{ data: null, error: null }],
      });

      await expect(
        requireOrganizationMembership(client, "private-workspace"),
      ).resolves.toEqual({ kind: "not-found" });
      expect(from).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects an unverified user before querying organization data", async () => {
    const { client, from } = createSupabaseClient({ userId: null });

    await expect(
      requireOrganizationMembership(client, "operations"),
    ).resolves.toEqual({ kind: "unauthenticated" });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("getFirstActiveMembership", () => {
  it("resolves the first active membership and organization", async () => {
    const { client, membershipQueries } = createSupabaseClient({
      membershipResults: [{ data: membership, error: null }],
      organizationResults: [{ data: organization, error: null }],
    });

    const result = await getFirstActiveMembership(client);

    expect(result).toEqual({
      kind: "active-member",
      context: {
        userId: "user-1",
        membershipId: "membership-1",
        role: "operator",
        organization,
      },
    });
    expect(membershipQueries[0].order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
    expect(membershipQueries[0].limit).toHaveBeenCalledWith(1);
  });

  it("returns no access when no active membership is visible", async () => {
    const { client } = createSupabaseClient({
      membershipResults: [{ data: null, error: null }],
    });

    await expect(getFirstActiveMembership(client)).resolves.toEqual({
      kind: "no-access",
      userId: "user-1",
    });
  });
});
