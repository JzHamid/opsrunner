import type { RequestUpdateField } from "@/lib/requests/validation";

export type OrganizationRole = "owner" | "admin" | "operator" | "viewer";

type RequestParticipants = {
  requester_id: string;
  assignee_id: string | null;
};

export function isOrganizationRole(value: string): value is OrganizationRole {
  return ["owner", "admin", "operator", "viewer"].includes(value);
}

export function canCreateRequest(role: string) {
  return role === "owner" || role === "admin" || role === "operator";
}

export function canCommentOnRequest(role: string) {
  return canCreateRequest(role);
}

export function canUpdateRequestField(
  role: string,
  userId: string,
  request: RequestParticipants,
  field: RequestUpdateField,
) {
  if (role === "owner" || role === "admin") return true;
  if (role !== "operator") return false;

  const isParticipant =
    request.requester_id === userId || request.assignee_id === userId;

  return isParticipant && field !== "assignee_id";
}
