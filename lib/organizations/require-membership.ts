import type { SupabaseClient } from "@supabase/supabase-js";
import { getVerifiedUserId } from "@/lib/auth/identity";
import type { Database } from "@/lib/supabase/database.types";

export type OrganizationMembershipContext = {
  userId: string;
  membershipId: string;
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

export type MembershipRequirement =
  | { kind: "authorized"; context: OrganizationMembershipContext }
  | { kind: "unauthenticated" }
  | { kind: "not-found" };

export async function requireOrganizationMembership(
  supabase: SupabaseClient<Database>,
  organizationSlug: string,
): Promise<MembershipRequirement> {
  const userId = await getVerifiedUserId(supabase);

  if (!userId) {
    return { kind: "unauthenticated" };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", organizationSlug)
    .maybeSingle();

  if (organizationError || !organization) {
    return { kind: "not-found" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("id, role")
    .eq("organization_id", organization.id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    return { kind: "not-found" };
  }

  return {
    kind: "authorized",
    context: {
      userId,
      membershipId: membership.id,
      role: membership.role,
      organization,
    },
  };
}
