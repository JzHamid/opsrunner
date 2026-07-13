import type { Tables } from "@/lib/supabase/database.types";
import type {
  RequestPriority,
  RequestStatus,
  RequestType,
} from "@/lib/requests/validation";

export type MemberLabel = {
  user_id: string;
  display_name: string;
  role: string;
};

export type MemberLabelMap = Map<string, string>;

const LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
  general: "General",
  client_update: "Client update",
  onboarding: "Onboarding",
  access: "Access",
  billing: "Billing",
  document: "Document",
  follow_up: "Follow-up",
  meeting: "Meeting",
  automation: "Automation",
};

export function requestLabel(
  value: RequestStatus | RequestPriority | RequestType | string,
) {
  return LABELS[value] ?? "Updated";
}

export function createMemberLabelMap(labels: MemberLabel[]): MemberLabelMap {
  return new Map(labels.map((member) => [member.user_id, member.display_name]));
}

export function memberDisplayName(
  userId: string | null,
  labels: MemberLabelMap,
  emptyLabel = "Unassigned",
) {
  if (!userId) return emptyLabel;
  return labels.get(userId) ?? "Former member";
}

export function formatDateOnly(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function toDateInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

type SortableRequest = Pick<
  Tables<"requests">,
  "status" | "priority" | "created_at"
>;

function requestSortGroup(request: SortableRequest) {
  if (request.status === "completed" || request.status === "cancelled") return 2;
  if (request.priority === "urgent" || request.priority === "high") return 0;
  return 1;
}

export function sortRequests<T extends SortableRequest>(requests: T[]) {
  return [...requests].sort((left, right) => {
    const groupDifference = requestSortGroup(left) - requestSortGroup(right);
    if (groupDifference !== 0) return groupDifference;
    return Date.parse(right.created_at) - Date.parse(left.created_at);
  });
}

function metadataValue(metadata: unknown, key: "from" | "to") {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : value === null ? null : undefined;
}

type RequestEvent = Pick<
  Tables<"request_events">,
  "event_type" | "metadata"
>;

export function requestActivityMessage(
  event: RequestEvent,
  labels: MemberLabelMap,
) {
  if (event.event_type === "request_created") return "Request created";

  const from = metadataValue(event.metadata, "from");
  const to = metadataValue(event.metadata, "to");

  if (event.event_type === "request_status_changed" && to) {
    return from
      ? `Status changed from ${requestLabel(from)} to ${requestLabel(to)}`
      : `Status changed to ${requestLabel(to)}`;
  }

  if (event.event_type === "request_priority_changed" && to) {
    return from
      ? `Priority changed from ${requestLabel(from)} to ${requestLabel(to)}`
      : `Priority changed to ${requestLabel(to)}`;
  }

  if (event.event_type === "request_assignee_changed") {
    if (to === null) return "Assignment removed";
    if (to) {
      const nextName = memberDisplayName(to, labels, "a team member");
      if (from) {
        const previousName = memberDisplayName(from, labels, "a team member");
        return `Assignment changed from ${previousName} to ${nextName}`;
      }
      return `Assigned to ${nextName}`;
    }
  }

  return "Request updated";
}
