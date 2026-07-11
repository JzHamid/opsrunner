import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireOrganizationMembership } from "@/lib/organizations/require-membership";
import { createClient } from "@/lib/supabase/server";

type OrganizationLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ organizationSlug: string }>;
};

export const dynamic = "force-dynamic";

export default async function OrganizationLayout({
  children,
  params,
}: OrganizationLayoutProps) {
  const { organizationSlug } = await params;
  const supabase = await createClient();
  const membership = await requireOrganizationMembership(
    supabase,
    organizationSlug,
  );

  if (membership.kind === "unauthenticated") {
    redirect("/login");
  }

  if (membership.kind === "not-found") {
    notFound();
  }

  return (
    <AppShell
      organizationName={membership.context.organization.name}
      organizationSlug={membership.context.organization.slug}
    >
      {children}
    </AppShell>
  );
}
