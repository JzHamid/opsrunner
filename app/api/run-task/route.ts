import { NextResponse } from "next/server";
import { requireOrganizationMembership } from "@/lib/organizations/require-membership";
import { createClient } from "@/lib/supabase/server";
import { getEmergencyFallbackContent } from "@/lib/task-output";
import { getApprovedTaskByType, type ApprovedTask } from "@/lib/workflows";

type NormalizedTaskResponse = {
  ok: true;
  taskType: string;
  title: string;
  body: string;
  nextSteps: string[];
  status: string;
  processedAt: string;
  runId?: string;
  source?: string;
  workflowStatus?: string;
  resultItems?: string[];
  data?: unknown;
};

const MAX_INPUT_LENGTH = 2_000;
const MAX_REFERENCE_LENGTH = 160;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function pickStringList(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      const items = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);

      return items;
    }

    if (typeof value === "string" && value.trim()) {
      return value
        .split(/\r?\n/)
        .map((item) => item.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
    }
  }

  return undefined;
}

async function readN8nResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

function isFallbackResponse(record: Record<string, unknown>) {
  const source = pickString(record, ["source"])?.toLowerCase();
  const workflowStatus = pickString(record, [
    "workflow_status",
    "workflowStatus",
    "status",
  ])?.toLowerCase();

  return source === "n8n-fallback" || workflowStatus === "fallback";
}

function normalizeStatus(value: string | undefined, isFallback: boolean) {
  if (isFallback) {
    return "Safe fallback";
  }

  if (!value) {
    return "Complete";
  }

  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeN8nResponse(
  data: unknown,
  task: ApprovedTask,
): NormalizedTaskResponse | null {
  const now = new Date().toISOString();

  if (!isRecord(data) || data.ok !== true) {
    return null;
  }

  const isFallback = isFallbackResponse(data);
  const statusValue = pickString(data, [
    "workflow_status",
    "workflowStatus",
    "status",
  ]);
  const responseTitle = pickString(data, ["title", "resultTitle", "heading"]);
  const responseBody = pickString(data, [
    "body",
    "result",
    "message",
    "summary",
    "output",
  ]);
  const responseNextSteps = pickStringList(data, [
    "next_steps",
    "nextSteps",
    "actions",
  ]);
  const responseResultItems = pickStringList(data, [
    "result_items",
    "resultItems",
    "checklist_items",
    "checklistItems",
  ]);
  const fallbackContent = getEmergencyFallbackContent();

  if (!isFallback && (!responseTitle || !responseBody)) {
    return null;
  }

  return {
    ok: true,
    taskType: pickString(data, ["task_type", "taskType"]) ?? task.taskType,
    title: isFallback
      ? (responseTitle ?? fallbackContent.title)
      : responseTitle!,
    body: isFallback ? (responseBody ?? fallbackContent.body) : responseBody!,
    nextSteps: isFallback
      ? responseNextSteps?.length
        ? responseNextSteps
        : fallbackContent.nextSteps
      : (responseNextSteps ?? []),
    status: normalizeStatus(statusValue, isFallback),
    processedAt:
      pickString(data, ["processed_at", "processedAt", "submittedAt"]) ?? now,
    runId: pickString(data, ["runId", "executionId", "id"]),
    source: pickString(data, ["source"]),
    workflowStatus: statusValue,
    resultItems:
      !isFallback && responseResultItems?.length
        ? responseResultItems
        : undefined,
    data,
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_request",
        error: "Send a valid JSON request.",
      },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_request",
        error: "Send a valid task request.",
      },
      { status: 400 },
    );
  }

  const organizationSlug =
    typeof body.organization_slug === "string"
      ? body.organization_slug.trim()
      : "";

  if (!organizationSlug) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_request",
        error: "Choose a valid workspace.",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const membership = await requireOrganizationMembership(
    supabase,
    organizationSlug,
  );

  if (membership.kind === "unauthenticated") {
    return NextResponse.json(
      {
        ok: false,
        code: "unauthorized",
        error: "Sign in to run this task.",
      },
      { status: 401 },
    );
  }

  if (membership.kind === "not-found") {
    return NextResponse.json(
      {
        ok: false,
        code: "forbidden",
        error: "This workspace is unavailable.",
      },
      { status: 404 },
    );
  }

  const taskType =
    typeof body.task_type === "string" ? body.task_type.trim() : "";
  const task = getApprovedTaskByType(taskType);

  if (!task) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_request",
        error: "This task is not approved.",
      },
      { status: 400 },
    );
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  const reference =
    typeof body.reference === "string" ? body.reference.trim() : "";

  if (!input) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_request",
        error: "Add the input for this task.",
      },
      { status: 400 },
    );
  }

  if (input.length > MAX_INPUT_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_request",
        error: "Keep the input under 2,000 characters.",
      },
      { status: 400 },
    );
  }

  if (reference.length > MAX_REFERENCE_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_request",
        error: "Keep the reference under 160 characters.",
      },
      { status: 400 },
    );
  }

  const webhookUrl = process.env.N8N_OPSRUNNER_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_OPSRUNNER_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_configured",
        error: "Complete the server workflow configuration to enable task runs.",
      },
      { status: 503 },
    );
  }

  let n8nResponse: Response;
  const requestedAt = new Date().toISOString();

  try {
    n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-OpsRunner-Secret": webhookSecret,
      },
      body: JSON.stringify({
        task_type: task.taskType,
        input,
        reference: reference || null,
        source: "opsrunner-web",
        organization_id: membership.context.organization.id,
        organization_slug: membership.context.organization.slug,
        user_id: membership.context.userId,
        requested_at: requestedAt,
      }),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "request_failed",
        error: "The workflow service could not be reached.",
      },
      { status: 502 },
    );
  }

  const responseData = await readN8nResponse(n8nResponse);

  if (!n8nResponse.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "request_failed",
        error: "The workflow did not accept this task.",
      },
      { status: 502 },
    );
  }

  const normalizedResponse = normalizeN8nResponse(responseData, task);

  if (!normalizedResponse) {
    return NextResponse.json(
      {
        ok: false,
        code: "request_failed",
        error: "The workflow did not return a usable result.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json(normalizedResponse);
}
