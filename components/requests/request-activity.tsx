import {
  formatDateTime,
  memberDisplayName,
  requestActivityMessage,
  type MemberLabelMap,
} from "@/lib/requests/presentation";
import type { RequestEvent } from "@/lib/requests/queries";

type RequestActivityProps = {
  events: RequestEvent[];
  memberLabels: MemberLabelMap;
};

export function RequestActivity({ events, memberLabels }: RequestActivityProps) {
  return (
    <details className="border-t border-line/60 pt-6">
      <summary className="cursor-pointer list-none text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent/15">
        Activity <span className="font-normal text-muted">({events.length})</span>
      </summary>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No activity recorded.</p>
      ) : (
        <ol className="mt-5 space-y-4">
          {events.map((event) => (
            <li key={event.id} className="grid grid-cols-[0.5rem_1fr] gap-3">
              <span className="mt-1.5 size-2 rounded-full bg-line" aria-hidden="true" />
              <div>
                <p className="text-sm text-foreground/85">
                  {requestActivityMessage(event, memberLabels)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {memberDisplayName(event.actor_id, memberLabels, "System")} / {formatDateTime(event.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
