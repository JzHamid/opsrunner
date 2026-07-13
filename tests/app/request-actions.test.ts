import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  requireMembershipMock,
  getMemberLabelsMock,
  getRequestMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireMembershipMock: vi.fn(),
  getMemberLabelsMock: vi.fn(),
  getRequestMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/organizations/require-membership", () => ({
  requireOrganizationMembership: requireMembershipMock,
}));
vi.mock("@/lib/requests/queries", () => ({
  getOrganizationMemberLabels: getMemberLabelsMock,
  getOrganizationRequest: getRequestMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import {
  addRequestComment,
  createRequest,
  updateRequest,
} from "@/app/org/[organizationSlug]/requests/actions";

const previousState = { ok: false };
const requestRecord = {
  id: "33000000-0000-4000-8000-000000000001",
  organization_id: "organization-trusted",
  requester_id: "user-trusted",
  assignee_id: "22000000-0000-4000-8000-000000000001",
};

function membership(role = "operator") {
  return {
    kind: "authorized",
    context: {
      userId: "user-trusted",
      membershipId: "membership-1",
      role,
      organization: {
        id: "organization-trusted",
        name: "Operations",
        slug: "operations",
      },
    },
  };
}

function validCreateForm() {
  const form = new FormData();
  form.set("title", "Prepare client update");
  form.set("description", "Collect the current milestones and decisions.");
  form.set("request_type", "client_update");
  form.set("priority", "high");
  form.set("assignee_id", "22000000-0000-4000-8000-000000000001");
  form.set("due_at", "2026-07-20");
  return form;
}

beforeEach(() => {
  createClientMock.mockReset();
  requireMembershipMock.mockReset().mockResolvedValue(membership());
  getMemberLabelsMock.mockReset().mockResolvedValue([
    {
      user_id: "22000000-0000-4000-8000-000000000001",
      display_name: "Alex",
      role: "operator",
    },
  ]);
  getRequestMock.mockReset().mockResolvedValue(requestRecord);
  redirectMock.mockReset().mockImplementation((path: string) => {
    throw new Error(`redirect:${path}`);
  });
  revalidatePathMock.mockReset();
});

describe("createRequest", () => {
  it.each(["owner", "admin", "operator"])(
    "allows an active %s and derives organization and requester identity",
    async (role) => {
      const requestBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: requestRecord.id },
          error: null,
        }),
      };
      const supabase = { from: vi.fn().mockReturnValue(requestBuilder) };
      createClientMock.mockResolvedValue(supabase);
      requireMembershipMock.mockResolvedValue(membership(role));

      await expect(
        createRequest("operations", previousState, validCreateForm()),
      ).rejects.toThrow(`redirect:/org/operations/requests/${requestRecord.id}`);

      expect(requestBuilder.insert).toHaveBeenCalledWith({
        organization_id: "organization-trusted",
        title: "Prepare client update",
        description: "Collect the current milestones and decisions.",
        request_type: "client_update",
        priority: "high",
        assignee_id: "22000000-0000-4000-8000-000000000001",
        due_at: "2026-07-20T00:00:00.000Z",
      });
      expect(requestBuilder.insert.mock.calls[0][0]).not.toHaveProperty("requester_id");
    },
  );

  it("denies viewers before any insert", async () => {
    const supabase = { from: vi.fn() };
    createClientMock.mockResolvedValue(supabase);
    requireMembershipMock.mockResolvedValue(membership("viewer"));

    await expect(
      createRequest("operations", previousState, validCreateForm()),
    ).resolves.toMatchObject({ ok: false, message: expect.stringContaining("permission") });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("rejects forged identity fields", async () => {
    const supabase = { from: vi.fn() };
    createClientMock.mockResolvedValue(supabase);
    const form = validCreateForm();
    form.set("organization_id", "forged");
    form.set("requester_id", "forged");

    await expect(
      createRequest("operations", previousState, form),
    ).resolves.toMatchObject({ ok: false, message: expect.stringContaining("unsupported") });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe("updateRequest", () => {
  it("allows a participating operator to update one execution field", async () => {
    const requestBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: requestRecord.id }, error: null }),
    };
    createClientMock.mockResolvedValue({ from: vi.fn().mockReturnValue(requestBuilder) });
    const form = new FormData();
    form.set("field", "status");
    form.set("value", "in_progress");

    await expect(
      updateRequest("operations", requestRecord.id, previousState, form),
    ).resolves.toEqual({ ok: true, message: "Saved" });
    expect(requestBuilder.update).toHaveBeenCalledWith({ status: "in_progress" });
    expect(requestBuilder.eq).toHaveBeenCalledWith(
      "organization_id",
      "organization-trusted",
    );
  });

  it("prevents operators from reassigning requests", async () => {
    createClientMock.mockResolvedValue({ from: vi.fn() });
    const form = new FormData();
    form.set("field", "assignee_id");
    form.set("value", "22000000-0000-4000-8000-000000000001");

    await expect(
      updateRequest("operations", requestRecord.id, previousState, form),
    ).resolves.toMatchObject({ ok: false, message: expect.stringContaining("permission") });
  });

  it("prevents unrelated operators and viewers from updating", async () => {
    createClientMock.mockResolvedValue({ from: vi.fn() });
    getRequestMock.mockResolvedValue({
      ...requestRecord,
      requester_id: "another-user",
      assignee_id: null,
    });
    const form = new FormData();
    form.set("field", "priority");
    form.set("value", "urgent");

    await expect(
      updateRequest("operations", requestRecord.id, previousState, form),
    ).resolves.toMatchObject({ ok: false });

    requireMembershipMock.mockResolvedValue(membership("viewer"));
    await expect(
      updateRequest("operations", requestRecord.id, previousState, form),
    ).resolves.toMatchObject({ ok: false });
  });

  it("rejects immutable fields and inaccessible request IDs", async () => {
    createClientMock.mockResolvedValue({ from: vi.fn() });
    const immutable = new FormData();
    immutable.set("field", "title");
    immutable.set("value", "Changed");
    await expect(
      updateRequest("operations", requestRecord.id, previousState, immutable),
    ).resolves.toMatchObject({ ok: false });

    getRequestMock.mockResolvedValue(null);
    const valid = new FormData();
    valid.set("field", "status");
    valid.set("value", "blocked");
    await expect(
      updateRequest("operations", "cross-org", previousState, valid),
    ).resolves.toEqual({ ok: false, message: "This request is unavailable." });
  });
});

describe("addRequestComment", () => {
  it.each(["owner", "admin", "operator"])(
    "allows an active %s and derives comment author identity",
    async (role) => {
      const insert = vi.fn().mockResolvedValue({ error: null });
      createClientMock.mockResolvedValue({
        from: vi.fn().mockReturnValue({ insert }),
      });
      requireMembershipMock.mockResolvedValue(membership(role));
      const form = new FormData();
      form.set("body", "Ready for review.");

      await expect(
        addRequestComment("operations", requestRecord.id, previousState, form),
      ).resolves.toEqual({ ok: true, message: "Comment added" });
      expect(insert).toHaveBeenCalledWith({
        organization_id: "organization-trusted",
        request_id: requestRecord.id,
        body: "Ready for review.",
      });
      expect(insert.mock.calls[0][0]).not.toHaveProperty("author_id");
    },
  );

  it("denies viewers and cross-organization request IDs", async () => {
    const from = vi.fn();
    createClientMock.mockResolvedValue({ from });
    requireMembershipMock.mockResolvedValue(membership("viewer"));
    const form = new FormData();
    form.set("body", "Comment");

    await expect(
      addRequestComment("operations", requestRecord.id, previousState, form),
    ).resolves.toMatchObject({ ok: false });
    expect(from).not.toHaveBeenCalled();

    requireMembershipMock.mockResolvedValue(membership("operator"));
    getRequestMock.mockResolvedValue(null);
    await expect(
      addRequestComment("operations", "cross-org", previousState, form),
    ).resolves.toEqual({ ok: false, message: "This request is unavailable." });
    expect(from).not.toHaveBeenCalled();
  });
});
