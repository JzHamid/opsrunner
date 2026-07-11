import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const supportedOtpTypes = new Set<EmailOtpType>(["email", "invite"]);

function redirectToLogin(request: NextRequest, reason: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("auth", reason);

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");

  if (!tokenHash || !rawType || !supportedOtpTypes.has(rawType as EmailOtpType)) {
    return redirectToLogin(request, "invalid-link");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType as EmailOtpType,
  });

  if (error) {
    return redirectToLogin(request, "invalid-link");
  }

  return NextResponse.redirect(new URL("/", request.url));
}
