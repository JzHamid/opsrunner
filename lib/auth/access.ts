import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type AuthAccess =
  | { kind: "unauthenticated" }
  | { kind: "active-member"; userId: string }
  | { kind: "no-access"; userId: string };

export async function getAuthAccess(
  supabase: SupabaseClient<Database>,
): Promise<AuthAccess> {
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string" || !userId) {
    return { kind: "unauthenticated" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return { kind: "no-access", userId };
  }

  return { kind: "active-member", userId };
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
    return pathname === "/login" || pathname === "/no-access" ? "/" : null;
  }

  return pathname === "/no-access" ? null : "/no-access";
}
