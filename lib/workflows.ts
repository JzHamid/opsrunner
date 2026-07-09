export const approvedTasks = [
  {
    id: "summarize-notes",
    taskType: "summarize_notes",
    name: "Summarize Notes",
    summary: "Turn rough notes into a concise operational summary.",
    inputPlaceholder:
      "Paste meeting notes, call notes, or raw context to summarize.",
    statusHint: "Routes to the approved summary workflow.",
  },
  {
    id: "generate-checklist",
    taskType: "generate_checklist",
    name: "Generate Checklist",
    summary: "Convert context into clear next actions.",
    inputPlaceholder:
      "Describe the process, task, or request that needs a checklist.",
    statusHint: "Routes to the approved checklist workflow.",
  },
  {
    id: "format-client-update",
    taskType: "format_client_update",
    name: "Format Client Update",
    summary: "Prepare a polished update from internal notes.",
    inputPlaceholder:
      "Add the details, status changes, and anything the client should know.",
    statusHint: "Routes to the approved client update workflow.",
  },
  {
    id: "create-follow-up-draft",
    taskType: "create_followup_draft",
    name: "Create Follow-up Draft",
    summary: "Draft a clear follow-up for open work.",
    inputPlaceholder:
      "Share the prior conversation, desired outcome, and any constraints.",
    statusHint: "Routes to the approved follow-up workflow.",
  },
] as const;

export type ApprovedTask = (typeof approvedTasks)[number];
export type ApprovedTaskId = ApprovedTask["id"];

export function getApprovedTask(taskId: string) {
  return approvedTasks.find((task) => task.id === taskId);
}

export const approvedWorkflows = approvedTasks;
export const getApprovedWorkflow = getApprovedTask;
