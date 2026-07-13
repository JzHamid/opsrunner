"use client";

import { useActionState } from "react";
import { updateRequest } from "@/app/org/[organizationSlug]/requests/actions";
import { requestLabel, toDateInputValue, type MemberLabel } from "@/lib/requests/presentation";
import {
  INITIAL_ACTION_STATE,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  type RequestUpdateField,
} from "@/lib/requests/validation";

type RequestControlsProps = {
  organizationSlug: string;
  requestId: string;
  status: string;
  priority: string;
  dueAt: string | null;
  assigneeId: string | null;
  members: MemberLabel[];
  allowedFields: RequestUpdateField[];
};

type FieldFormProps = {
  action: (
    state: typeof INITIAL_ACTION_STATE,
    formData: FormData,
  ) => Promise<typeof INITIAL_ACTION_STATE>;
  field: RequestUpdateField;
  label: string;
  children: React.ReactNode;
};

function FieldForm({ action, field, label, children }: FieldFormProps) {
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
      <input type="hidden" name="field" value={field} />
      <span className="text-sm font-medium text-muted">{label}</span>
      {children}
      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-foreground transition hover:border-foreground/20 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Saving..." : "Save"}
      </button>
      {state.message ? (
        <p
          className={`text-xs sm:col-start-2 sm:col-span-2 ${state.ok ? "text-accent" : "text-danger"}`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function RequestControls({
  organizationSlug,
  requestId,
  status,
  priority,
  dueAt,
  assigneeId,
  members,
  allowedFields,
}: RequestControlsProps) {
  if (allowedFields.length === 0) return null;

  const action = updateRequest.bind(null, organizationSlug, requestId);
  const inputClass =
    "h-10 min-w-0 rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/10";

  return (
    <details className="group border-t border-line/60 pt-5">
      <summary className="cursor-pointer list-none text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/15">
        <span className="group-open:hidden">Update request</span>
        <span className="hidden group-open:inline">Close updates</span>
      </summary>

      <div className="mt-5 space-y-4 rounded-lg bg-surface-muted/55 p-4 sm:p-5">
        {allowedFields.includes("status") ? (
          <FieldForm action={action} field="status" label="Status">
            <select name="value" defaultValue={status} className={inputClass}>
              {REQUEST_STATUSES.map((value) => (
                <option key={value} value={value}>{requestLabel(value)}</option>
              ))}
            </select>
          </FieldForm>
        ) : null}

        {allowedFields.includes("priority") ? (
          <FieldForm action={action} field="priority" label="Priority">
            <select name="value" defaultValue={priority} className={inputClass}>
              {REQUEST_PRIORITIES.map((value) => (
                <option key={value} value={value}>{requestLabel(value)}</option>
              ))}
            </select>
          </FieldForm>
        ) : null}

        {allowedFields.includes("due_at") ? (
          <FieldForm action={action} field="due_at" label="Due date">
            <input
              name="value"
              type="date"
              defaultValue={toDateInputValue(dueAt)}
              className={inputClass}
            />
          </FieldForm>
        ) : null}

        {allowedFields.includes("assignee_id") ? (
          <FieldForm action={action} field="assignee_id" label="Assignee">
            <select name="value" defaultValue={assigneeId ?? ""} className={inputClass}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.display_name}
                </option>
              ))}
            </select>
          </FieldForm>
        ) : null}
      </div>
    </details>
  );
}
