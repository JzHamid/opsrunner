import { NextResponse, type NextRequest } from "next/server";
import { getAuthRedirect } from "@/lib/auth/access";
import {
  copyAuthResponseState,
  updateSession,
} from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { access, response } = await updateSession(request);
  const redirectPath = getAuthRedirect(request.nextUrl.pathname, access);

  if (!redirectPath) {
    return response;
  }

  const redirectResponse = NextResponse.redirect(
    new URL(redirectPath, request.url),
  );

  return copyAuthResponseState(response, redirectResponse);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
