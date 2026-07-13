import { describe, expect, it, vi } from "vitest";
import {
  getOrganizationMemberLabels,
  getOrganizationRequest,
  getOrganizationRequests,
  REQUEST_LIST_LIMIT,
} from "@/lib/requests/queries";

describe("request queries", () => {
  it("applies trusted organization filters, approved URL filters, and the row cap", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const builder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    };
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(builder),
      }),
    };

    await getOrganizationRequests(
      supabase as never,
      "trusted-organization",
      { status: "blocked", priority: "urgent" },
    );

    expect(supabase.from).toHaveBeenCalledWith("requests");
    expect(builder.eq).toHaveBeenNthCalledWith(
      1,
      "organization_id",
      "trusted-organization",
    );
    expect(builder.eq).toHaveBeenNthCalledWith(2, "status", "blocked");
    expect(builder.eq).toHaveBeenNthCalledWith(3, "priority", "urgent");
    expect(limit).toHaveBeenCalledWith(REQUEST_LIST_LIMIT);
  });

  it("scopes detail lookup to both trusted organization and request ID", async () => {
    const builder = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(builder),
      }),
    };

    await expect(
      getOrganizationRequest(
        supabase as never,
        "trusted-organization",
        "unknown-or-cross-organization-request",
      ),
    ).resolves.toBeNull();

    expect(builder.eq).toHaveBeenNthCalledWith(
      1,
      "organization_id",
      "trusted-organization",
    );
    expect(builder.eq).toHaveBeenNthCalledWith(
      2,
      "id",
      "unknown-or-cross-organization-request",
    );
  });

  it("uses only the narrow member-label RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          user_id: "member-1",
          display_name: "Alex",
          role: "operator",
        },
      ],
      error: null,
    });

    await expect(
      getOrganizationMemberLabels({ rpc } as never, "trusted-organization"),
    ).resolves.toEqual([
      { user_id: "member-1", display_name: "Alex", role: "operator" },
    ]);
    expect(rpc).toHaveBeenCalledWith("get_organization_member_labels", {
      target_organization_id: "trusted-organization",
    });
  });
});
