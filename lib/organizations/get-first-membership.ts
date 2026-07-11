import type { SupabaseClient } from "@supabase/supabase-js";
import { getVerifiedUserId } from "@/lib/auth/identity";
import type { OrganizationMembershipContext } from "@/lib/organizations/require-membership";
import type { Database } from "@/lib/supabase/database.types";

export type FirstMembershipResult =
  | { kind: "active-member"; context: OrganizationMembershipContext }
  | { kind: "unauthenticated" }
  | { kind: "no-access"; userId: string };

export async function getFirstActiveMembership(
  supabase: SupabaseClient<Database>,
): Promise<FirstMembershipResult> {
  const userId = await getVerifiedUserId(supabase);

  if (!userId) {
    return { kind: "unauthenticated" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("id, organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return { kind: "no-access", userId };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError || !organization) {
    return { kind: "no-access", userId };
  }

  return {
    kind: "active-member",
    context: {
      userId,
      membershipId: membership.id,
      role: membership.role,
      organization,
    },
  };
}
