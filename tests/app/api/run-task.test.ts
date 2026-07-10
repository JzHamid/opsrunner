import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/run-task/route";

const TEST_WEBHOOK_URL = "https://n8n.test/webhook/opsrunner";
const originalWebhookUrl = process.env.N8N_OPSRUNNER_WEBHOOK_URL;
const fetchMock = vi.fn<typeof fetch>();

function createRequest(body: unknown) {
  return new Request("http://localhost/api/run-task", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createTaskRequest(
  overrides: {
    taskId?: string;
    input?: string;
    reference?: string;
  } = {},
) {
  return createRequest({
    taskId: overrides.taskId ?? "summarize-notes",
    payload: {
      input: overrides.input ?? "Client approved scope; we will deliver Friday",
      reference: overrides.reference ?? "OPS-42",
    },
  });
}

function createN8nResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  process.env.N8N_OPSRUNNER_WEBHOOK_URL = TEST_WEBHOOK_URL;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();

  if (originalWebhookUrl === undefined) {
    delete process.env.N8N_OPSRUNNER_WEBHOOK_URL;
  } else {
    process.env.N8N_OPSRUNNER_WEBHOOK_URL = originalWebhookUrl;
  }
});

describe("POST /api/run-task", () => {
  it("rejects malformed JSON without calling n8n", async () => {
    const request = new Request("http://localhost/api/run-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({
      ok: false,
      code: "invalid_request",
      error: "Send a valid JSON request.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "an unapproved task",
      request: createTaskRequest({ taskId: "delete-client" }),
      error: "This task is not approved.",
    },
    {
      name: "empty input",
      request: createTaskRequest({ input: "   " }),
      error: "Add the input for this task.",
    },
  ])("rejects $name without calling n8n", async ({ request, error }) => {
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({
      ok: false,
      code: "invalid_request",
      error,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "input over 2,000 characters",
      request: createTaskRequest({ input: "x".repeat(2_001) }),
      error: "Keep the input under 2,000 characters.",
    },
    {
      name: "reference over 160 characters",
      request: createTaskRequest({ reference: "r".repeat(161) }),
      error: "Keep the reference under 160 characters.",
    },
  ])("rejects $name without calling n8n", async ({ request, error }) => {
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({
      ok: false,
      code: "invalid_request",
      error,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts input and reference values at their exact limits", async () => {
    const input = "x".repeat(2_000);
    const reference = "r".repeat(160);
    fetchMock.mockResolvedValue(
      createN8nResponse({
        ok: true,
        title: "Notes Summary",
        result: "Processed.",
        next_steps: ["Review the result."],
        source: "n8n",
        workflow_status: "completed",
        processed_at: "2026-07-10T10:00:00.000Z",
      }),
    );

    const response = await POST(createTaskRequest({ input, reference }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0];
    const forwardedBody = JSON.parse(String(options?.body)) as Record<
      string,
      unknown
    >;

    expect(url).toBe(TEST_WEBHOOK_URL);
    expect(options?.method).toBe("POST");
    expect(forwardedBody).toEqual({
      task_type: "summarize_notes",
      input,
      source: "opsrunner-web",
      reference,
      submittedAt: expect.any(String),
    });
  });

  it("normalizes a successful n8n response without changing deterministic output", async () => {
    const n8nResponse = {
      ok: true,
      task_type: "summarize_notes",
      title: "Workflow title",
      result: "Workflow body",
      next_steps: ["Workflow next step"],
      source: "n8n",
      workflow_status: "completed",
      processed_at: "2026-07-10T10:00:00.000Z",
      executionId: "run-123",
    };
    fetchMock.mockResolvedValue(createN8nResponse(n8nResponse));

    const response = await POST(createTaskRequest());
    const result = await readJson(response);

    expect(response.status).toBe(200);
    expect(result).toEqual({
      ok: true,
      title: "Notes Summary",
      body: "Approval was received for scope. The team will deliver Friday.",
      nextSteps: [
        "Confirm the owner and due date.",
        "Share the agreed actions.",
      ],
      status: "Completed",
      processedAt: "2026-07-10T10:00:00.000Z",
      runId: "run-123",
      source: "n8n",
      workflowStatus: "completed",
      data: n8nResponse,
    });
  });

  it("treats an ok n8n fallback response as a successful safe fallback", async () => {
    const fallbackResponse = {
      ok: true,
      task_type: "summarize_notes",
      title: "Fallback Result",
      result: "A safe structured fallback result.",
      next_steps: ["Review the output", "Run again later if needed"],
      source: "n8n-fallback",
      workflow_status: "fallback",
      notice: "A safe fallback result was returned.",
      processed_at: "2026-07-10T10:00:00.000Z",
    };
    fetchMock.mockResolvedValue(createN8nResponse(fallbackResponse));

    const response = await POST(createTaskRequest());

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      ok: true,
      title: "Fallback Result",
      body: "A safe structured fallback result.",
      nextSteps: ["Review the output", "Run again later if needed"],
      status: "Safe fallback",
      processedAt: "2026-07-10T10:00:00.000Z",
      source: "n8n-fallback",
      workflowStatus: "fallback",
      data: fallbackResponse,
    });
  });

  it("returns a failure when n8n responds with ok false", async () => {
    fetchMock.mockResolvedValue(
      createN8nResponse({
        ok: false,
        error: "Workflow rejected the request.",
      }),
    );

    const response = await POST(createTaskRequest());

    expect(response.status).toBe(502);
    expect(await readJson(response)).toEqual({
      ok: false,
      code: "request_failed",
      error: "The workflow did not return a usable result.",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
