import { describe, expect, it } from "vitest";
import {
  normalizeDueDate,
  parseRequestFilters,
  validateCreateRequest,
  validateRequestComment,
  validateRequestUpdate,
} from "@/lib/requests/validation";

function createForm(overrides: Record<string, string> = {}) {
  const values = new FormData();
  const defaults = {
    title: "Prepare onboarding pack",
    description: "Gather the approved documents for the new client.",
    request_type: "onboarding",
    priority: "high",
    assignee_id: "11000000-0000-4000-8000-000000000001",
    due_at: "2026-07-20",
  };

  Object.entries({ ...defaults, ...overrides }).forEach(([key, value]) => {
    values.set(key, value);
  });
  return values;
}

describe("request creation validation", () => {
  it("normalizes an approved request payload", () => {
    expect(validateCreateRequest(createForm())).toEqual({
      ok: true,
      value: {
        title: "Prepare onboarding pack",
        description: "Gather the approved documents for the new client.",
        requestType: "onboarding",
        priority: "high",
        assigneeId: "11000000-0000-4000-8000-000000000001",
        dueAt: "2026-07-20T00:00:00.000Z",
      },
    });
  });

  it.each([
    ["title", "", "Enter a title."],
    ["title", "x".repeat(201), "Use 200 characters or fewer."],
    ["description", "", "Enter a description."],
    ["description", "x".repeat(20_001), "Use 20,000 characters or fewer."],
    ["request_type", "unknown", "Choose a valid request type."],
    ["priority", "critical", "Choose a valid priority."],
    ["assignee_id", "not-a-uuid", "Choose a valid assignee."],
  ])("rejects invalid %s", (field, value, message) => {
    const result = validateCreateRequest(createForm({ [field]: value }));
    expect(result).toMatchObject({
      ok: false,
      state: { fieldErrors: { [field]: message } },
    });
  });

  it("rejects browser-supplied identity fields", () => {
    const form = createForm();
    form.set("organization_id", "forged");
    form.set("requester_id", "forged");

    expect(validateCreateRequest(form)).toMatchObject({
      ok: false,
      state: { message: "The request included unsupported fields." },
    });
  });
});

describe("request date and filter validation", () => {
  it("uses an exact UTC date and rejects impossible dates", () => {
    expect(normalizeDueDate("2026-02-28")).toEqual({
      ok: true,
      value: "2026-02-28T00:00:00.000Z",
    });
    expect(normalizeDueDate("2026-02-30")).toMatchObject({ ok: false });
  });

  it("keeps only approved URL filters", () => {
    expect(parseRequestFilters({ status: "blocked", priority: "urgent" })).toEqual({
      status: "blocked",
      priority: "urgent",
    });
    expect(parseRequestFilters({ status: "private", priority: "critical" })).toEqual({
      status: undefined,
      priority: undefined,
    });
  });
});

describe("request update and comment validation", () => {
  it("accepts exactly one allowlisted update", () => {
    const form = new FormData();
    form.set("field", "status");
    form.set("value", "completed");
    expect(validateRequestUpdate(form)).toEqual({
      ok: true,
      field: "status",
      value: "completed",
    });
  });

  it("rejects immutable and arbitrary patch fields", () => {
    const form = new FormData();
    form.set("field", "title");
    form.set("value", "Forged title");
    form.set("organization_id", "forged");
    expect(validateRequestUpdate(form)).toMatchObject({ ok: false });
  });

  it("enforces the comment limit", () => {
    const valid = new FormData();
    valid.set("body", "  Ready for review.  ");
    expect(validateRequestComment(valid)).toEqual({
      ok: true,
      body: "Ready for review.",
    });

    const invalid = new FormData();
    invalid.set("body", "x".repeat(10_001));
    expect(validateRequestComment(invalid)).toMatchObject({ ok: false });
  });
});
