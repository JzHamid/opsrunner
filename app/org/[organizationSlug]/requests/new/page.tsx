import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestForm } from "@/components/requests/request-form";
import { requireOrganizationMembership } from "@/lib/organizations/require-membership";
import { canCreateRequest } from "@/lib/requests/permissions";
import { getOrganizationMemberLabels } from "@/lib/requests/queries";
import { createClient } from "@/lib/supabase/server";

type NewRequestPageProps = {
  params: Promise<{ organizationSlug: string }>;
};

export default async function NewRequestPage({ params }: NewRequestPageProps) {
  const { organizationSlug } = await params;
  const supabase = await createClient();
  const membership = await requireOrganizationMembership(
    supabase,
    organizationSlug,
  );

  if (membership.kind === "unauthenticated") redirect("/login");
  if (membership.kind === "not-found") notFound();

  const requestsPath = `/org/${encodeURIComponent(membership.context.organization.slug)}/requests`;

  if (!canCreateRequest(membership.context.role)) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <Link href={requestsPath} className="text-sm font-medium text-muted hover:text-foreground">
          Back to requests
        </Link>
        <section className="mt-8 rounded-lg bg-surface px-6 py-12 text-center shadow-[0_12px_32px_rgba(21,31,28,0.05)] ring-1 ring-black/[0.04]">
          <h1 className="text-xl font-semibold">Request creation is unavailable.</h1>
          <p className="mt-2 text-sm text-muted">Your workspace access is read-only.</p>
        </section>
      </main>
    );
  }

  const members = await getOrganizationMemberLabels(
    supabase,
    membership.context.organization.id,
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <Link href={requestsPath} className="text-sm font-medium text-muted hover:text-foreground">
        Back to requests
      </Link>
      <header className="mt-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">New request</h1>
        <p className="mt-2 text-sm text-muted">Capture the context needed to move work forward.</p>
      </header>

      <section className="mt-8 rounded-lg bg-surface p-5 shadow-[0_14px_38px_rgba(21,31,28,0.06)] ring-1 ring-black/[0.04] sm:p-8">
        <RequestForm
          organizationSlug={membership.context.organization.slug}
          members={members}
        />
      </section>
    </main>
  );
}
