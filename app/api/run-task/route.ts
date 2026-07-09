import { NextResponse } from "next/server";
import { getApprovedTask, type ApprovedTask } from "@/lib/workflows";

type NormalizedTaskResponse = {
  ok: true;
  title: string;
  body: string;
  nextSteps: string[];
  status: string;
  processedAt: string;
  runId?: string;
  source?: string;
  workflowStatus?: string;
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

      if (items.length > 0) {
        return items.slice(0, 4);
      }
    }

    if (typeof value === "string" && value.trim()) {
      return value
        .split(/\r?\n/)
        .map((item) => item.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 4);
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
): NormalizedTaskResponse {
  const now = new Date().toISOString();

  if (isRecord(data)) {
    const isFallback = isFallbackResponse(data);
    const statusValue = pickString(data, [
      "workflow_status",
      "workflowStatus",
      "status",
    ]);

    return {
      ok: true,
      title:
        pickString(data, ["title", "resultTitle", "heading"]) ??
        (isFallback ? "Safe fallback prepared" : `${task.name} complete`),
      body:
        pickString(data, ["body", "result", "message", "summary", "output"]) ??
        (isFallback
          ? "The workflow used its fallback path and returned a usable result."
          : "The task finished successfully."),
      nextSteps:
        pickStringList(data, ["next_steps", "nextSteps", "actions"]) ??
        ["Review the result before sharing it.", "Run again if the input changes."],
      status: normalizeStatus(statusValue, isFallback),
      processedAt:
        pickString(data, ["processed_at", "processedAt", "submittedAt"]) ?? now,
      runId: pickString(data, ["runId", "executionId", "id"]),
      source: pickString(data, ["source"]),
      workflowStatus: statusValue,
      data,
    };
  }

  if (typeof data === "string" && data.trim()) {
    return {
      ok: true,
      title: `${task.name} complete`,
      body: data.trim().slice(0, 1_200),
      nextSteps: ["Review the result before sharing it."],
      status: "Complete",
      processedAt: now,
      data: { text: data.trim() },
    };
  }

  return {
    ok: true,
    title: `${task.name} complete`,
    body: "The task finished successfully.",
    nextSteps: ["Review the result before sharing it."],
    status: "Complete",
    processedAt: now,
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

  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  const task = getApprovedTask(taskId);

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

  const payload = isRecord(body.payload) ? body.payload : {};
  const input = typeof payload.input === "string" ? payload.input.trim() : "";
  const reference =
    typeof payload.reference === "string" ? payload.reference.trim() : "";

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

  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_configured",
        error: "Add the n8n webhook URL on the server to enable task runs.",
      },
      { status: 503 },
    );
  }

  let n8nResponse: Response;

  try {
    n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        task_type: task.taskType,
        input,
        source: "opsrunner-web",
        reference: reference || null,
        submittedAt: new Date().toISOString(),
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

  return NextResponse.json(normalizeN8nResponse(responseData, task));
}
