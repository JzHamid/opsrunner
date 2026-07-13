import Link from "next/link";
import {
  formatDateOnly,
  formatDateTime,
  memberDisplayName,
  requestLabel,
  type MemberLabelMap,
} from "@/lib/requests/presentation";
import type { RequestListItem } from "@/lib/requests/queries";

type RequestListProps = {
  organizationSlug: string;
  requests: RequestListItem[];
  memberLabels: MemberLabelMap;
};

export function RequestList({
  organizationSlug,
  requests,
  memberLabels,
}: RequestListProps) {
  return (
    <div className="overflow-hidden rounded-lg bg-surface shadow-[0_12px_32px_rgba(21,31,28,0.06)] ring-1 ring-black/[0.04]">
      {requests.map((request, index) => (
        <Link
          key={request.id}
          href={`/org/${encodeURIComponent(organizationSlug)}/requests/${encodeURIComponent(request.id)}`}
          className={`group block px-5 py-5 outline-none transition hover:bg-[#f8faf8] focus-visible:bg-[#f5f9f6] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/25 sm:px-6 ${
            index > 0 ? "border-t border-line/60" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold text-foreground group-hover:text-accent">
                {request.title}
              </h2>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span>{requestLabel(request.status)}</span>
                <span aria-hidden="true" className="text-line">/</span>
                <span>{requestLabel(request.priority)}</span>
                <span aria-hidden="true" className="text-line">/</span>
                <span>{memberDisplayName(request.assignee_id, memberLabels)}</span>
              </p>
            </div>

            <span className="shrink-0 text-sm text-muted transition group-hover:translate-x-0.5 group-hover:text-foreground">
              View
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span>{request.due_at ? `Due ${formatDateOnly(request.due_at)}` : "No due date"}</span>
            <span>Created {formatDateTime(request.created_at)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
