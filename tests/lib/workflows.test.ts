import { describe, expect, it } from "vitest";
import { approvedTasks, getApprovedTask } from "@/lib/workflows";

describe("approved task registry", () => {
  it("preserves the approved task IDs and n8n task types", () => {
    expect(
      approvedTasks.map(({ id, taskType }) => ({ id, taskType })),
    ).toEqual([
      { id: "summarize-notes", taskType: "summarize_notes" },
      { id: "generate-checklist", taskType: "generate_checklist" },
      { id: "format-client-update", taskType: "format_client_update" },
      {
        id: "create-follow-up-draft",
        taskType: "create_followup_draft",
      },
    ]);
  });

  it("resolves approved IDs and rejects unknown tasks", () => {
    expect(getApprovedTask("generate-checklist")?.taskType).toBe(
      "generate_checklist",
    );
    expect(getApprovedTask("unapproved-task")).toBeUndefined();
  });

  it("keeps task IDs and task types unique", () => {
    const ids = approvedTasks.map(({ id }) => id);
    const taskTypes = approvedTasks.map(({ taskType }) => taskType);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(taskTypes).size).toBe(taskTypes.length);
  });
});
