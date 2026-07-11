import type { SupabaseClient } from "@supabase/supabase-js";
import { getFirstActiveMembership } from "@/lib/organizations/get-first-membership";
import type { Database } from "@/lib/supabase/database.types";

export type AuthAccess =
  | { kind: "unauthenticated" }
  | { kind: "active-member"; userId: string; organizationSlug: string }
  | { kind: "no-access"; userId: string };

export async function getAuthAccess(
  supabase: SupabaseClient<Database>,
): Promise<AuthAccess> {
  const membership = await getFirstActiveMembership(supabase);

  if (membership.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (membership.kind === "no-access") {
    return membership;
  }

  return {
    kind: "active-member",
    userId: membership.context.userId,
    organizationSlug: membership.context.organization.slug,
  };
}

const membershipBypassPaths = new Set(["/auth/confirm", "/auth/sign-out"]);

export function getAuthRedirect(pathname: string, access: AuthAccess) {
  if (membershipBypassPaths.has(pathname)) {
    return null;
  }

  if (access.kind === "unauthenticated") {
    return pathname === "/login" ? null : "/login";
  }

  if (access.kind === "active-member") {
    return pathname === "/login" || pathname === "/no-access"
      ? `/org/${encodeURIComponent(access.organizationSlug)}/run`
      : null;
  }

  return pathname === "/no-access" ? null : "/no-access";
}
