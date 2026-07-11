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
