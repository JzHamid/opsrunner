import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestActivity } from "@/components/requests/request-activity";
import { RequestCommentForm } from "@/components/requests/request-comment-form";
import { RequestComments } from "@/components/requests/request-comments";
import { RequestControls } from "@/components/requests/request-controls";
import { requireOrganizationMembership } from "@/lib/organizations/require-membership";
import {
  canCommentOnRequest,
  canUpdateRequestField,
} from "@/lib/requests/permissions";
import {
  createMemberLabelMap,
  formatDateOnly,
  formatDateTime,
  memberDisplayName,
  requestLabel,
} from "@/lib/requests/presentation";
import {
  getOrganizationMemberLabels,
  getOrganizationRequest,
  getRequestComments,
  getRequestEvents,
} from "@/lib/requests/queries";
import type { RequestUpdateField } from "@/lib/requests/validation";
import { createClient } from "@/lib/supabase/server";

type RequestDetailPageProps = {
  params: Promise<{ organizationSlug: string; requestId: string }>;
};

export default async function RequestDetailPage({ params }: RequestDetailPageProps) {
  const { organizationSlug, requestId } = await params;
  const supabase = await createClient();
  const membership = await requireOrganizationMembership(
    supabase,
    organizationSlug,
  );

  if (membership.kind === "unauthenticated") redirect("/login");
  if (membership.kind === "not-found") notFound();

  const organizationId = membership.context.organization.id;
  const request = await getOrganizationRequest(
    supabase,
    organizationId,
    requestId,
  );

  if (!request) notFound();

  const [comments, events, members] = await Promise.all([
    getRequestComments(supabase, organizationId, request.id),
    getRequestEvents(supabase, organizationId, request.id),
    getOrganizationMemberLabels(supabase, organizationId),
  ]);
  const memberLabels = createMemberLabelMap(members);
  const candidateFields: RequestUpdateField[] = [
    "status",
    "priority",
    "due_at",
    "assignee_id",
  ];
  const allowedFields = candidateFields.filter((field) =>
    canUpdateRequestField(
      membership.context.role,
      membership.context.userId,
      request,
      field,
    ),
  );
  const requestsPath = `/org/${encodeURIComponent(membership.context.organization.slug)}/requests`;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12 lg:px-10">
      <Link href={requestsPath} className="text-sm font-medium text-muted hover:text-foreground">
        Back to requests
      </Link>

      <article className="mt-6 rounded-lg bg-surface px-5 py-6 shadow-[0_14px_38px_rgba(21,31,28,0.06)] ring-1 ring-black/[0.04] sm:px-8 sm:py-8">
        <header>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-accent">
                {requestLabel(request.request_type)}
              </p>
              <h1 className="mt-2 break-words text-2xl font-semibold leading-tight sm:text-3xl">
                {request.title}
              </h1>
            </div>
            <span className="self-start rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold text-foreground/75">
              {requestLabel(request.status)}
            </span>
          </div>

          <dl className="mt-6 grid gap-x-8 gap-y-4 border-y border-line/60 py-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-muted">Priority</dt>
              <dd className="mt-1 font-medium">{requestLabel(request.priority)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Assignee</dt>
              <dd className="mt-1 font-medium">{memberDisplayName(request.assignee_id, memberLabels)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Requester</dt>
              <dd className="mt-1 font-medium">{memberDisplayName(request.requester_id, memberLabels, "Former member")}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Due</dt>
              <dd className="mt-1 font-medium">{formatDateOnly(request.due_at)}</dd>
            </div>
          </dl>
        </header>

        <section className="py-7">
          <h2 className="text-sm font-semibold">Description</h2>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-foreground/85">
            {request.description}
          </p>
          <p className="mt-5 text-xs text-muted">
            Created {formatDateTime(request.created_at)} / Updated {formatDateTime(request.updated_at)}
          </p>
        </section>

        <RequestControls
          organizationSlug={membership.context.organization.slug}
          requestId={request.id}
          status={request.status}
          priority={request.priority}
          dueAt={request.due_at}
          assigneeId={request.assignee_id}
          members={members}
          allowedFields={allowedFields}
        />
      </article>

      <section className="mt-8 border-t border-line/70 px-1 py-7 sm:px-3">
        <h2 className="text-lg font-semibold">Comments</h2>
        <RequestComments comments={comments} memberLabels={memberLabels} />
        {canCommentOnRequest(membership.context.role) ? (
          <RequestCommentForm
            organizationSlug={membership.context.organization.slug}
            requestId={request.id}
          />
        ) : null}
      </section>

      <section className="mt-2 border-t border-line/70 px-1 py-7 sm:px-3">
        <RequestActivity events={events} memberLabels={memberLabels} />
      </section>
    </main>
  );
}
