import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestList } from "@/components/requests/request-list";
import { requireOrganizationMembership } from "@/lib/organizations/require-membership";
import { canCreateRequest } from "@/lib/requests/permissions";
import {
  createMemberLabelMap,
  requestLabel,
} from "@/lib/requests/presentation";
import {
  getOrganizationMemberLabels,
  getOrganizationRequests,
} from "@/lib/requests/queries";
import {
  parseRequestFilters,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
} from "@/lib/requests/validation";
import { createClient } from "@/lib/supabase/server";

type RequestsPageProps = {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{
    status?: string | string[];
    priority?: string | string[];
  }>;
};

export default async function RequestsPage({
  params,
  searchParams,
}: RequestsPageProps) {
  const [{ organizationSlug }, rawFilters] = await Promise.all([
    params,
    searchParams,
  ]);
  const supabase = await createClient();
  const membership = await requireOrganizationMembership(
    supabase,
    organizationSlug,
  );

  if (membership.kind === "unauthenticated") redirect("/login");
  if (membership.kind === "not-found") notFound();

  const filters = parseRequestFilters(rawFilters);
  const [requests, members] = await Promise.all([
    getOrganizationRequests(
      supabase,
      membership.context.organization.id,
      filters,
    ),
    getOrganizationMemberLabels(
      supabase,
      membership.context.organization.id,
    ),
  ]);
  const hasFilters = Boolean(filters.status || filters.priority);
  const basePath = `/org/${encodeURIComponent(membership.context.organization.slug)}/requests`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12 lg:px-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-accent">
            Workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Requests</h1>
          <p className="mt-2 text-sm text-muted">Operational work requiring attention.</p>
        </div>

        {canCreateRequest(membership.context.role) ? (
          <Link
            href={`${basePath}/new`}
            className="inline-flex h-11 items-center justify-center self-start rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(27,117,83,0.18)] transition hover:bg-[#156344] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 sm:self-auto"
          >
            New request
          </Link>
        ) : null}
      </div>

      <form
        action={basePath}
        method="get"
        className="mt-8 flex flex-col gap-3 border-y border-line/60 py-4 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 sm:w-48">
          <span className="text-xs font-semibold text-muted">Status</span>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="mt-1.5 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
          >
            <option value="">All statuses</option>
            {REQUEST_STATUSES.map((value) => (
              <option key={value} value={value}>{requestLabel(value)}</option>
            ))}
          </select>
        </label>

        <label className="min-w-0 sm:w-48">
          <span className="text-xs font-semibold text-muted">Priority</span>
          <select
            name="priority"
            defaultValue={filters.priority ?? ""}
            className="mt-1.5 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
          >
            <option value="">All priorities</option>
            {REQUEST_PRIORITIES.map((value) => (
              <option key={value} value={value}>{requestLabel(value)}</option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-semibold transition hover:border-foreground/20 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/15"
        >
          Apply
        </button>

        {hasFilters ? (
          <Link href={basePath} className="px-2 py-2 text-sm font-medium text-muted hover:text-foreground">
            Clear
          </Link>
        ) : null}
      </form>

      <section className="mt-7" aria-label="Request list">
        {requests.length > 0 ? (
          <RequestList
            organizationSlug={membership.context.organization.slug}
            requests={requests}
            memberLabels={createMemberLabelMap(members)}
          />
        ) : (
          <div className="rounded-lg bg-surface px-6 py-14 text-center shadow-[0_12px_32px_rgba(21,31,28,0.05)] ring-1 ring-black/[0.04]">
            <h2 className="text-base font-semibold">
              {hasFilters ? "No matching requests" : "No requests yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
              {hasFilters
                ? "Adjust the filters to see more operational work."
                : "Operational work will appear here as it is added."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
