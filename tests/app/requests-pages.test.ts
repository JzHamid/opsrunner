import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  requireMembershipMock,
  getRequestsMock,
  getMemberLabelsMock,
  getRequestMock,
  getCommentsMock,
  getEventsMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireMembershipMock: vi.fn(),
  getRequestsMock: vi.fn(),
  getMemberLabelsMock: vi.fn(),
  getRequestMock: vi.fn(),
  getCommentsMock: vi.fn(),
  getEventsMock: vi.fn(),
  redirectMock: vi.fn(),
  notFoundMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/organizations/require-membership", () => ({
  requireOrganizationMembership: requireMembershipMock,
}));
vi.mock("@/lib/requests/queries", () => ({
  getOrganizationRequests: getRequestsMock,
  getOrganizationMemberLabels: getMemberLabelsMock,
  getOrganizationRequest: getRequestMock,
  getRequestComments: getCommentsMock,
  getRequestEvents: getEventsMock,
}));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

import RequestDetailPage from "@/app/org/[organizationSlug]/requests/[requestId]/page";
import RequestsPage from "@/app/org/[organizationSlug]/requests/page";
import RunPage from "@/app/org/[organizationSlug]/run/page";

function authorized(role = "operator") {
  return {
    kind: "authorized",
    context: {
      userId: "user-1",
      membershipId: "membership-1",
      role,
      organization: { id: "organization-1", name: "Operations", slug: "operations" },
    },
  };
}

function textContent(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  if (node && typeof node === "object" && "props" in node) {
    return textContent((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}

beforeEach(() => {
  createClientMock.mockReset().mockResolvedValue({});
  requireMembershipMock.mockReset().mockResolvedValue(authorized());
  getRequestsMock.mockReset().mockResolvedValue([]);
  getMemberLabelsMock.mockReset().mockResolvedValue([]);
  getRequestMock.mockReset();
  getCommentsMock.mockReset().mockResolvedValue([]);
  getEventsMock.mockReset().mockResolvedValue([]);
  redirectMock.mockReset().mockImplementation((path: string) => {
    throw new Error(`redirect:${path}`);
  });
  notFoundMock.mockReset().mockImplementation(() => {
    throw new Error("not-found");
  });
});

describe("requests workspace pages", () => {
  it("reauthorizes the exact organization and shows the create action to operators", async () => {
    const element = await RequestsPage({
      params: Promise.resolve({ organizationSlug: "operations" }),
      searchParams: Promise.resolve({}),
    });

    expect(requireMembershipMock).toHaveBeenCalledWith(expect.anything(), "operations");
    expect(getRequestsMock).toHaveBeenCalledWith(
      expect.anything(),
      "organization-1",
      { status: undefined, priority: undefined },
    );
    expect(textContent(element)).toContain("New request");
    expect(textContent(element)).toContain("No requests yet");
  });

  it("keeps viewers read-only", async () => {
    requireMembershipMock.mockResolvedValue(authorized("viewer"));
    const element = await RequestsPage({
      params: Promise.resolve({ organizationSlug: "operations" }),
      searchParams: Promise.resolve({}),
    });

    expect(textContent(element)).not.toContain("New request");
  });

  it("renders a distinct filtered no-results state", async () => {
    const element = await RequestsPage({
      params: Promise.resolve({ organizationSlug: "operations" }),
      searchParams: Promise.resolve({ status: "blocked" }),
    });

    expect(textContent(element)).toContain("No matching requests");
  });

  it.each(["unknown", "cross-organization"])(
    "uses the same not-found behavior for an %s request ID",
    async (requestId) => {
      getRequestMock.mockResolvedValue(null);
      await expect(
        RequestDetailPage({
          params: Promise.resolve({ organizationSlug: "operations", requestId }),
        }),
      ).rejects.toThrow("not-found");
    },
  );

  it("preserves the protected Run route", async () => {
    const element = await RunPage({
      params: Promise.resolve({ organizationSlug: "operations" }),
    });
    expect(element.props.organizationSlug).toBe("operations");
  });
});
