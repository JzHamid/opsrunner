import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, requireMembershipMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireMembershipMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/organizations/require-membership", () => ({
  requireOrganizationMembership: requireMembershipMock,
}));

import { POST } from "@/app/api/run-task/route";

const TEST_WEBHOOK_URL = "https://n8n.test/webhook/opsrunner";
const TEST_WEBHOOK_SECRET = "test-webhook-secret";
const originalWebhookUrl = process.env.N8N_OPSRUNNER_WEBHOOK_URL;
const originalWebhookSecret = process.env.N8N_OPSRUNNER_WEBHOOK_SECRET;
const fetchMock = vi.fn<typeof fetch>();

const authorizedMembership = {
  kind: "authorized",
  context: {
    userId: "user-trusted",
    membershipId: "membership-1",
    role: "operator",
    organization: {
      id: "organization-trusted",
      name: "OpsRunner Workspace",
      slug: "opsrunner-workspace",
    },
  },
} as const;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/run-task", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createTaskRequest(
  overrides: {
    taskType?: string;
    input?: string;
    reference?: string;
    organizationSlug?: string;
    extra?: Record<string, unknown>;
  } = {},
) {
  return createRequest({
    task_type: overrides.taskType ?? "summarize_notes",
    input: overrides.input ?? "Client approved scope; we will deliver Friday",
    reference: overrides.reference ?? "OPS-42",
    organization_slug:
      overrides.organizationSlug ?? "opsrunner-workspace",
    ...overrides.extra,
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
  process.env.N8N_OPSRUNNER_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  fetchMock.mockReset();
  createClientMock.mockReset().mockResolvedValue({});
  requireMembershipMock.mockReset().mockResolvedValue(authorizedMembership);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();

  if (originalWebhookUrl === undefined) {
    delete process.env.N8N_OPSRUNNER_WEBHOOK_URL;
  } else {
    process.env.N8N_OPSRUNNER_WEBHOOK_URL = originalWebhookUrl;
  }

  if (originalWebhookSecret === undefined) {
    delete process.env.N8N_OPSRUNNER_WEBHOOK_SECRET;
  } else {
    process.env.N8N_OPSRUNNER_WEBHOOK_SECRET = originalWebhookSecret;
  }
});

describe("POST /api/run-task authorization", () => {
  it("rejects malformed JSON without authorizing or calling n8n", async () => {
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
    expect(requireMembershipMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 for an unauthenticated request without calling n8n", async () => {
    requireMembershipMock.mockResolvedValue({ kind: "unauthenticated" });

    const response = await POST(createTaskRequest());

    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({
      ok: false,
      code: "unauthorized",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call n8n when membership is missing or cross-organization", async () => {
    requireMembershipMock.mockResolvedValue({ kind: "not-found" });

    const response = await POST(
      createTaskRequest({ organizationSlug: "another-workspace" }),
    );

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({
      ok: false,
      code: "forbidden",
      error: "This workspace is unavailable.",
    });
    expect(requireMembershipMock).toHaveBeenCalledWith(
      expect.anything(),
      "another-workspace",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/run-task validation", () => {
  it.each([
    {
      name: "an unapproved task",
      request: () => createTaskRequest({ taskType: "delete_client" }),
      error: "This task is not approved.",
    },
    {
      name: "empty input",
      request: () => createTaskRequest({ input: "   " }),
      error: "Add the input for this task.",
    },
  ])("rejects $name without calling n8n", async ({ request, error }) => {
    const response = await POST(request());

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
      request: () => createTaskRequest({ input: "x".repeat(2_001) }),
      error: "Keep the input under 2,000 characters.",
    },
    {
      name: "reference over 160 characters",
      request: () => createTaskRequest({ reference: "r".repeat(161) }),
      error: "Keep the reference under 160 characters.",
    },
  ])("rejects $name without calling n8n", async ({ request, error }) => {
    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({
      ok: false,
      code: "invalid_request",
      error,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/run-task n8n execution", () => {
  it("sends the secret header and server-derived identity context", async () => {
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

    const response = await POST(
      createTaskRequest({
        input,
        reference,
        extra: {
          user_id: "user-spoofed",
          organization_id: "organization-spoofed",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options?.headers);
    const forwardedBody = JSON.parse(String(options?.body)) as Record<
      string,
      unknown
    >;

    expect(url).toBe(TEST_WEBHOOK_URL);
    expect(options?.method).toBe("POST");
    expect(headers.get("X-OpsRunner-Secret")).toBe(TEST_WEBHOOK_SECRET);
    expect(forwardedBody).toEqual({
      task_type: "summarize_notes",
      input,
      reference,
      source: "opsrunner-web",
      organization_id: "organization-trusted",
      organization_slug: "opsrunner-workspace",
      user_id: "user-trusted",
      requested_at: expect.any(String),
    });
  });

  it("fails safely without exposing or sending a missing server secret", async () => {
    delete process.env.N8N_OPSRUNNER_WEBHOOK_SECRET;

    const response = await POST(createTaskRequest());
    const result = await readJson(response);

    expect(response.status).toBe(503);
    expect(result).toEqual({
      ok: false,
      code: "not_configured",
      error: "Complete the server workflow configuration to enable task runs.",
    });
    expect(JSON.stringify(result)).not.toContain(TEST_WEBHOOK_SECRET);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves successful n8n content as the source of truth", async () => {
    const n8nResponse = {
      ok: true,
      task_type: "summarize_notes",
      title: "Workflow title",
      result: "Workflow body",
      next_steps: ["Workflow next step", " ", 42],
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
      taskType: "summarize_notes",
      title: "Workflow title",
      body: "Workflow body",
      nextSteps: ["Workflow next step"],
      status: "Completed",
      processedAt: "2026-07-10T10:00:00.000Z",
      runId: "run-123",
      source: "n8n",
      workflowStatus: "completed",
      data: n8nResponse,
    });
  });

  it("preserves improved checklist content and structured items", async () => {
    const n8nResponse = {
      ok: true,
      task_type: "generate_checklist",
      title: "Launch Checklist",
      result: [
        "1. Finalize the landing page design.",
        "2. Run QA tests on the mobile app.",
        "3. Confirm influencer contracts.",
      ].join("\n"),
      result_items: [
        "Finalize the landing page design.",
        "Run QA tests on the mobile app.",
        "Confirm influencer contracts.",
      ],
      next_steps: ["Assign an owner and due date to each item."],
      source: "n8n",
      workflow_status: "completed",
      processed_at: "2026-07-10T10:00:00.000Z",
    };
    fetchMock.mockResolvedValue(createN8nResponse(n8nResponse));

    const response = await POST(
      createTaskRequest({ taskType: "generate_checklist" }),
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      ok: true,
      taskType: "generate_checklist",
      title: "Launch Checklist",
      body: n8nResponse.result,
      resultItems: n8nResponse.result_items,
      nextSteps: n8nResponse.next_steps,
    });
  });

  it("does not shorten an n8n-generated client update", async () => {
    const clientUpdate = [
      "Hello,",
      "",
      "Project Alpha continues to progress smoothly. Sprint 5 is complete, QA begins next week, risks remain low, and the project remains within budget.",
      "",
      "The Beta release remains scheduled for August 1.",
      "",
      "Best,",
    ].join("\n");
    fetchMock.mockResolvedValue(
      createN8nResponse({
        ok: true,
        task_type: "format_client_update",
        title: "Client Update",
        result: clientUpdate,
        next_steps: ["Review names and dates before sending."],
        source: "n8n",
        workflow_status: "completed",
        processed_at: "2026-07-10T10:00:00.000Z",
      }),
    );

    const response = await POST(
      createTaskRequest({ taskType: "format_client_update" }),
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      taskType: "format_client_update",
      title: "Client Update",
      body: clientUpdate,
      nextSteps: ["Review names and dates before sending."],
    });
  });

  it("does not regenerate an n8n-generated follow-up draft", async () => {
    const followUp = [
      "Hello,",
      "",
      "Thank you for your time yesterday and for sharing your feedback.",
      "",
      "We will send the revised proposal by Friday.",
      "",
      "Best,",
    ].join("\n");
    fetchMock.mockResolvedValue(
      createN8nResponse({
        ok: true,
        task_type: "create_followup_draft",
        title: "Follow-up Draft",
        result: followUp,
        next_steps: ["Add the recipient name and sender sign-off."],
        source: "n8n",
        workflow_status: "completed",
        processed_at: "2026-07-10T10:00:00.000Z",
      }),
    );

    const response = await POST(
      createTaskRequest({ taskType: "create_followup_draft" }),
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      taskType: "create_followup_draft",
      title: "Follow-up Draft",
      body: followUp,
      nextSteps: ["Add the recipient name and sender sign-off."],
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
      taskType: "summarize_notes",
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

  it("uses emergency local content for an incomplete successful fallback", async () => {
    const fallbackResponse = {
      ok: true,
      task_type: "summarize_notes",
      source: "n8n-fallback",
      workflow_status: "fallback",
      processed_at: "2026-07-10T10:00:00.000Z",
    };
    fetchMock.mockResolvedValue(createN8nResponse(fallbackResponse));

    const response = await POST(createTaskRequest());

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      ok: true,
      taskType: "summarize_notes",
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

  it("fails safely when a successful structured response has no usable result", async () => {
    fetchMock.mockResolvedValue(
      createN8nResponse({
        ok: true,
        task_type: "summarize_notes",
        title: "Missing result",
        next_steps: [],
        source: "n8n",
        workflow_status: "completed",
      }),
    );

    const response = await POST(createTaskRequest());

    expect(response.status).toBe(502);
    expect(await readJson(response)).toEqual({
      ok: false,
      code: "request_failed",
      error: "The workflow did not return a usable result.",
    });
  });

  it("fails safely when n8n returns a plain-text response", async () => {
    fetchMock.mockResolvedValue(
      new Response("Unstructured workflow output", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    const response = await POST(createTaskRequest());

    expect(response.status).toBe(502);
    expect(await readJson(response)).toMatchObject({
      ok: false,
      code: "request_failed",
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
