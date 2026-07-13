"use client";

import { useActionState } from "react";
import { createRequest } from "@/app/org/[organizationSlug]/requests/actions";
import { requestLabel, type MemberLabel } from "@/lib/requests/presentation";
import {
  INITIAL_ACTION_STATE,
  REQUEST_PRIORITIES,
  REQUEST_TYPES,
} from "@/lib/requests/validation";

type RequestFormProps = {
  organizationSlug: string;
  members: MemberLabel[];
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-2 text-xs text-danger">{message}</p> : null;
}

export function RequestForm({ organizationSlug, members }: RequestFormProps) {
  const action = createRequest.bind(null, organizationSlug);
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_ACTION_STATE,
  );
  const fieldClass =
    "mt-2 w-full rounded-lg border border-line bg-white px-3.5 text-sm text-foreground outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/10";

  return (
    <form action={formAction} className="space-y-7">
      {state.message ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/15 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <label className="block">
        <span className="text-sm font-semibold">Title</span>
        <input
          name="title"
          required
          maxLength={200}
          className={`${fieldClass} h-11`}
          placeholder="What needs attention?"
        />
        <FieldError message={state.fieldErrors?.title} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold">Description</span>
        <textarea
          name="description"
          required
          maxLength={20_000}
          rows={7}
          className={`${fieldClass} resize-y py-3 leading-6`}
          placeholder="Add the context needed to complete this request."
        />
        <FieldError message={state.fieldErrors?.description} />
      </label>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Type</span>
          <select name="request_type" defaultValue="general" className={`${fieldClass} h-11`}>
            {REQUEST_TYPES.map((value) => (
              <option key={value} value={value}>{requestLabel(value)}</option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.request_type} />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Priority</span>
          <select name="priority" defaultValue="normal" className={`${fieldClass} h-11`}>
            {REQUEST_PRIORITIES.map((value) => (
              <option key={value} value={value}>{requestLabel(value)}</option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.priority} />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Assignee</span>
          <select name="assignee_id" defaultValue="" className={`${fieldClass} h-11`}>
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.display_name}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.assignee_id} />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Due date</span>
          <input name="due_at" type="date" className={`${fieldClass} h-11`} />
          <FieldError message={state.fieldErrors?.due_at} />
        </label>
      </div>

      <div className="flex justify-end border-t border-line/60 pt-6">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(27,117,83,0.18)] transition hover:bg-[#156344] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Creating..." : "Create request"}
        </button>
      </div>
    </form>
  );
}
