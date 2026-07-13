import { redirect } from "next/navigation";
import { getFirstActiveMembership } from "@/lib/organizations/get-first-membership";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const membership = await getFirstActiveMembership(supabase);

  if (membership.kind === "unauthenticated") {
    redirect("/login");
  }

  if (membership.kind === "no-access") {
    redirect("/no-access");
  }

  redirect(
    `/org/${encodeURIComponent(membership.context.organization.slug)}/requests`,
  );
}
