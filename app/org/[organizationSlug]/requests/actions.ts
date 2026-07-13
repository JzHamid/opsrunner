"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationMembership } from "@/lib/organizations/require-membership";
import {
  canCommentOnRequest,
  canCreateRequest,
  canUpdateRequestField,
} from "@/lib/requests/permissions";
import {
  getOrganizationMemberLabels,
  getOrganizationRequest,
} from "@/lib/requests/queries";
import {
  validateCreateRequest,
  validateRequestComment,
  validateRequestUpdate,
  type RequestActionState,
} from "@/lib/requests/validation";
import { createClient } from "@/lib/supabase/server";
import type { Database, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthorizedAction = {
  supabase: SupabaseClient<Database>;
  userId: string;
  role: string;
  organizationId: string;
  organizationSlug: string;
};

async function authorizeAction(
  organizationSlug: string,
): Promise<AuthorizedAction | RequestActionState> {
  const supabase = await createClient();
  const membership = await requireOrganizationMembership(
    supabase,
    organizationSlug,
  );

  if (membership.kind === "unauthenticated") redirect("/login");
  if (membership.kind === "not-found") {
    return { ok: false, message: "This workspace is unavailable." };
  }

  return {
    supabase,
    userId: membership.context.userId,
    role: membership.context.role,
    organizationId: membership.context.organization.id,
    organizationSlug: membership.context.organization.slug,
  };
}

function isActionError(
  value: AuthorizedAction | RequestActionState,
): value is RequestActionState {
  return !("supabase" in value);
}

async function isAssignableMember(
  authorization: AuthorizedAction,
  userId: string,
) {
  const labels = await getOrganizationMemberLabels(
    authorization.supabase,
    authorization.organizationId,
  );
  return labels.some((member) => member.user_id === userId);
}

export async function createRequest(
  organizationSlug: string,
  _previousState: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const authorization = await authorizeAction(organizationSlug);
  if (isActionError(authorization)) return authorization;

  if (!canCreateRequest(authorization.role)) {
    return { ok: false, message: "You do not have permission to create requests." };
  }

  const validation = validateCreateRequest(formData);
  if (!validation.ok) return validation.state;

  if (
    validation.value.assigneeId &&
    !(await isAssignableMember(authorization, validation.value.assigneeId))
  ) {
    return {
      ok: false,
      message: "Review the highlighted fields.",
      fieldErrors: { assignee_id: "Choose an active assignable member." },
    };
  }

  const request: TablesInsert<"requests"> = {
    organization_id: authorization.organizationId,
    title: validation.value.title,
    description: validation.value.description,
    request_type: validation.value.requestType,
    priority: validation.value.priority,
    assignee_id: validation.value.assigneeId,
    due_at: validation.value.dueAt,
  };

  const { data, error } = await authorization.supabase
    .from("requests")
    .insert(request)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "The request could not be created." };
  }

  redirect(
    `/org/${encodeURIComponent(authorization.organizationSlug)}/requests/${encodeURIComponent(data.id)}`,
  );
}

export async function updateRequest(
  organizationSlug: string,
  requestId: string,
  _previousState: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const authorization = await authorizeAction(organizationSlug);
  if (isActionError(authorization)) return authorization;

  const validation = validateRequestUpdate(formData);
  if (!validation.ok) return validation.state;

  const request = await getOrganizationRequest(
    authorization.supabase,
    authorization.organizationId,
    requestId,
  );

  if (!request) return { ok: false, message: "This request is unavailable." };

  if (
    !canUpdateRequestField(
      authorization.role,
      authorization.userId,
      request,
      validation.field,
    )
  ) {
    return { ok: false, message: "You do not have permission to update this field." };
  }

  if (
    validation.field === "assignee_id" &&
    validation.value &&
    !(await isAssignableMember(authorization, validation.value))
  ) {
    return { ok: false, message: "Choose an active assignable member." };
  }

  const update = {
    [validation.field]: validation.value,
  } as TablesUpdate<"requests">;

  const { data, error } = await authorization.supabase
    .from("requests")
    .update(update)
    .eq("organization_id", authorization.organizationId)
    .eq("id", requestId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "The request could not be updated." };
  }

  const listPath = `/org/${encodeURIComponent(authorization.organizationSlug)}/requests`;
  const detailPath = `${listPath}/${encodeURIComponent(requestId)}`;
  revalidatePath(listPath);
  revalidatePath(detailPath);

  return { ok: true, message: "Saved" };
}

export async function addRequestComment(
  organizationSlug: string,
  requestId: string,
  _previousState: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const authorization = await authorizeAction(organizationSlug);
  if (isActionError(authorization)) return authorization;

  if (!canCommentOnRequest(authorization.role)) {
    return { ok: false, message: "You do not have permission to add comments." };
  }

  const validation = validateRequestComment(formData);
  if (!validation.ok) return validation.state;

  const request = await getOrganizationRequest(
    authorization.supabase,
    authorization.organizationId,
    requestId,
  );

  if (!request) return { ok: false, message: "This request is unavailable." };

  const comment: TablesInsert<"request_comments"> = {
    organization_id: authorization.organizationId,
    request_id: request.id,
    body: validation.body,
  };

  const { error } = await authorization.supabase
    .from("request_comments")
    .insert(comment);

  if (error) {
    return { ok: false, message: "The comment could not be added." };
  }

  revalidatePath(
    `/org/${encodeURIComponent(authorization.organizationSlug)}/requests/${encodeURIComponent(requestId)}`,
  );

  return { ok: true, message: "Comment added" };
}
