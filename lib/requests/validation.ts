export const REQUEST_TYPES = [
  "general",
  "client_update",
  "onboarding",
  "access",
  "billing",
  "document",
  "follow_up",
  "meeting",
  "automation",
] as const;

export const REQUEST_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export const REQUEST_STATUSES = [
  "open",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];
export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type RequestUpdateField =
  | "status"
  | "priority"
  | "due_at"
  | "assignee_id";

export type RequestFilters = {
  status?: RequestStatus;
  priority?: RequestPriority;
};

export type CreateRequestValues = {
  title: string;
  description: string;
  requestType: RequestType;
  priority: RequestPriority;
  assigneeId: string | null;
  dueAt: string | null;
};

export type RequestActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const INITIAL_ACTION_STATE: RequestActionState = { ok: false };

const CREATE_FIELDS = new Set([
  "title",
  "description",
  "request_type",
  "priority",
  "assignee_id",
  "due_at",
]);
const UPDATE_FIELDS = new Set<RequestUpdateField>([
  "status",
  "priority",
  "due_at",
  "assignee_id",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function hasUnexpectedFields(formData: FormData, allowed: Set<string>) {
  return Array.from(formData.keys()).some(
    (key) => !allowed.has(key) && !key.startsWith("$ACTION_"),
  );
}

function isOneOf<T extends string>(value: string, values: readonly T[]): value is T {
  return values.includes(value as T);
}

export function normalizeDueDate(value: string) {
  const dateValue = value.trim();

  if (!dateValue) {
    return { ok: true as const, value: null };
  }

  if (!DATE_PATTERN.test(dateValue)) {
    return { ok: false as const, error: "Choose a valid due date." };
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false as const, error: "Choose a valid due date." };
  }

  return { ok: true as const, value: date.toISOString() };
}

export function parseRequestFilters(values: {
  status?: string | string[];
  priority?: string | string[];
}): RequestFilters {
  const rawStatus = Array.isArray(values.status) ? values.status[0] : values.status;
  const rawPriority = Array.isArray(values.priority)
    ? values.priority[0]
    : values.priority;

  return {
    status:
      rawStatus && isOneOf(rawStatus, REQUEST_STATUSES) ? rawStatus : undefined,
    priority:
      rawPriority && isOneOf(rawPriority, REQUEST_PRIORITIES)
        ? rawPriority
        : undefined,
  };
}

export function validateCreateRequest(formData: FormData):
  | { ok: true; value: CreateRequestValues }
  | { ok: false; state: RequestActionState } {
  if (hasUnexpectedFields(formData, CREATE_FIELDS)) {
    return {
      ok: false,
      state: { ok: false, message: "The request included unsupported fields." },
    };
  }

  const title = getString(formData, "title").trim();
  const description = getString(formData, "description").trim();
  const requestType = getString(formData, "request_type");
  const priority = getString(formData, "priority");
  const assigneeId = getString(formData, "assignee_id").trim();
  const dueDate = normalizeDueDate(getString(formData, "due_at"));
  const fieldErrors: Record<string, string> = {};

  if (!title) fieldErrors.title = "Enter a title.";
  else if (title.length > 200) fieldErrors.title = "Use 200 characters or fewer.";

  if (!description) fieldErrors.description = "Enter a description.";
  else if (description.length > 20_000) {
    fieldErrors.description = "Use 20,000 characters or fewer.";
  }

  if (!isOneOf(requestType, REQUEST_TYPES)) {
    fieldErrors.request_type = "Choose a valid request type.";
  }

  if (!isOneOf(priority, REQUEST_PRIORITIES)) {
    fieldErrors.priority = "Choose a valid priority.";
  }

  if (assigneeId && !UUID_PATTERN.test(assigneeId)) {
    fieldErrors.assignee_id = "Choose a valid assignee.";
  }

  if (!dueDate.ok) fieldErrors.due_at = dueDate.error;

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      state: {
        ok: false,
        message: "Review the highlighted fields.",
        fieldErrors,
      },
    };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      requestType: requestType as RequestType,
      priority: priority as RequestPriority,
      assigneeId: assigneeId || null,
      dueAt: dueDate.ok ? dueDate.value : null,
    },
  };
}

export function validateRequestUpdate(formData: FormData):
  | { ok: true; field: RequestUpdateField; value: string | null }
  | { ok: false; state: RequestActionState } {
  const allowedKeys = new Set(["field", "value"]);

  if (hasUnexpectedFields(formData, allowedKeys)) {
    return {
      ok: false,
      state: { ok: false, message: "Only one request field can be updated." },
    };
  }

  const field = getString(formData, "field") as RequestUpdateField;
  const rawValue = getString(formData, "value");

  if (!UPDATE_FIELDS.has(field)) {
    return {
      ok: false,
      state: { ok: false, message: "That request field cannot be updated." },
    };
  }

  if (field === "status") {
    return isOneOf(rawValue, REQUEST_STATUSES)
      ? { ok: true, field, value: rawValue }
      : { ok: false, state: { ok: false, message: "Choose a valid status." } };
  }

  if (field === "priority") {
    return isOneOf(rawValue, REQUEST_PRIORITIES)
      ? { ok: true, field, value: rawValue }
      : { ok: false, state: { ok: false, message: "Choose a valid priority." } };
  }

  if (field === "due_at") {
    const dueDate = normalizeDueDate(rawValue);
    return dueDate.ok
      ? { ok: true, field, value: dueDate.value }
      : { ok: false, state: { ok: false, message: dueDate.error } };
  }

  const assigneeId = rawValue.trim();
  if (assigneeId && !UUID_PATTERN.test(assigneeId)) {
    return {
      ok: false,
      state: { ok: false, message: "Choose a valid assignee." },
    };
  }

  return { ok: true, field, value: assigneeId || null };
}

export function validateRequestComment(formData: FormData):
  | { ok: true; body: string }
  | { ok: false; state: RequestActionState } {
  const allowedKeys = new Set(["body"]);
  if (hasUnexpectedFields(formData, allowedKeys)) {
    return {
      ok: false,
      state: { ok: false, message: "The comment included unsupported fields." },
    };
  }

  const body = getString(formData, "body").trim();
  if (!body) {
    return { ok: false, state: { ok: false, message: "Enter a comment." } };
  }

  if (body.length > 10_000) {
    return {
      ok: false,
      state: { ok: false, message: "Use 10,000 characters or fewer." },
    };
  }

  return { ok: true, body };
}
