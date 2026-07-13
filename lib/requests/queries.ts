import type { SupabaseClient } from "@supabase/supabase-js";
import { sortRequests, type MemberLabel } from "@/lib/requests/presentation";
import type { RequestFilters } from "@/lib/requests/validation";
import type { Database, Tables } from "@/lib/supabase/database.types";

export const REQUEST_LIST_LIMIT = 100;

export type RequestListItem = Pick<
  Tables<"requests">,
  | "id"
  | "title"
  | "status"
  | "priority"
  | "assignee_id"
  | "due_at"
  | "created_at"
>;

export type RequestDetail = Tables<"requests">;
export type RequestComment = Tables<"request_comments">;
export type RequestEvent = Tables<"request_events">;

export async function getOrganizationMemberLabels(
  supabase: SupabaseClient<Database>,
  organizationId: string,
) {
  const { data, error } = await supabase.rpc("get_organization_member_labels", {
    target_organization_id: organizationId,
  });

  if (error) throw new Error("Member labels could not be loaded.");
  return (data ?? []) as MemberLabel[];
}

export async function getOrganizationRequests(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: RequestFilters,
) {
  let query = supabase
    .from("requests")
    .select("id, title, status, priority, assignee_id, due_at, created_at")
    .eq("organization_id", organizationId);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(REQUEST_LIST_LIMIT);

  if (error) throw new Error("Requests could not be loaded.");
  return sortRequests((data ?? []) as RequestListItem[]);
}

export async function getOrganizationRequest(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  requestId: string,
) {
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw new Error("The request could not be loaded.");
  return data as RequestDetail | null;
}

export async function getRequestComments(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  requestId: string,
) {
  const { data, error } = await supabase
    .from("request_comments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("request_id", requestId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error("Comments could not be loaded.");
  return (data ?? []) as RequestComment[];
}

export async function getRequestEvents(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  requestId: string,
) {
  const { data, error } = await supabase
    .from("request_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("request_id", requestId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error("Activity could not be loaded.");
  return (data ?? []) as RequestEvent[];
}
