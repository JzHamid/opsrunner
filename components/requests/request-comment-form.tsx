"use client";

import { useActionState, useRef } from "react";
import { addRequestComment } from "@/app/org/[organizationSlug]/requests/actions";
import {
  INITIAL_ACTION_STATE,
  type RequestActionState,
} from "@/lib/requests/validation";

type RequestCommentFormProps = {
  organizationSlug: string;
  requestId: string;
};

export function RequestCommentForm({
  organizationSlug,
  requestId,
}: RequestCommentFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = addRequestComment.bind(null, organizationSlug, requestId);
  const [state, formAction, isPending] = useActionState(
    async (previousState: RequestActionState, formData: FormData) => {
      const nextState = await action(previousState, formData);
      if (nextState.ok) formRef.current?.reset();
      return nextState;
    },
    INITIAL_ACTION_STATE,
  );

  return (
    <form ref={formRef} action={formAction} className="mt-5">
      <label htmlFor="request-comment" className="sr-only">Add comment</label>
      <textarea
        id="request-comment"
        name="body"
        rows={3}
        maxLength={10_000}
        required
        placeholder="Add a comment"
        className="w-full resize-y rounded-lg border border-line bg-white px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
      />
      <div className="mt-3 flex items-center justify-between gap-4">
        <p
          className={`text-xs ${state.ok ? "text-accent" : "text-danger"}`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-white transition hover:bg-[#27312e] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Adding..." : "Add comment"}
        </button>
      </div>
    </form>
  );
}
