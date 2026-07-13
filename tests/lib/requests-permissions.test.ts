import { describe, expect, it } from "vitest";
import {
  canCommentOnRequest,
  canCreateRequest,
  canUpdateRequestField,
} from "@/lib/requests/permissions";

const request = { requester_id: "requester", assignee_id: "assignee" };

describe("request role permissions", () => {
  it.each(["owner", "admin", "operator"])("allows %s to create and comment", (role) => {
    expect(canCreateRequest(role)).toBe(true);
    expect(canCommentOnRequest(role)).toBe(true);
  });

  it("keeps viewers read-only", () => {
    expect(canCreateRequest("viewer")).toBe(false);
    expect(canCommentOnRequest("viewer")).toBe(false);
    expect(canUpdateRequestField("viewer", "viewer", request, "status")).toBe(false);
  });

  it.each(["owner", "admin"])("allows %s to update every exposed field", (role) => {
    expect(canUpdateRequestField(role, "manager", request, "status")).toBe(true);
    expect(canUpdateRequestField(role, "manager", request, "assignee_id")).toBe(true);
  });

  it.each(["requester", "assignee"])(
    "allows a participating operator to update execution fields but not assignment",
    (userId) => {
      expect(canUpdateRequestField("operator", userId, request, "status")).toBe(true);
      expect(canUpdateRequestField("operator", userId, request, "priority")).toBe(true);
      expect(canUpdateRequestField("operator", userId, request, "due_at")).toBe(true);
      expect(canUpdateRequestField("operator", userId, request, "assignee_id")).toBe(false);
    },
  );

  it("prevents an unrelated operator from changing request fields", () => {
    expect(canUpdateRequestField("operator", "other", request, "status")).toBe(false);
  });
});
