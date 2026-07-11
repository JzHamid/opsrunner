"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getConfirmationUrl() {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    return null;
  }

  try {
    const url = new URL(appUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.pathname = "/auth/confirm";
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function requestMagicLink(formData: FormData) {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const emailRedirectTo = getConfirmationUrl();

  if (!isValidEmail(email)) {
    redirect("/login?auth=invalid-email");
  }

  if (!emailRedirectTo) {
    redirect("/login?auth=unavailable");
  }

  try {
    const supabase = await createClient();

    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo,
      },
    });
  } catch {
    // Keep the response neutral to avoid revealing whether the account exists.
  }

  redirect("/login?sent=1");
}
