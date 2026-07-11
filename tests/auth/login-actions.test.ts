import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, redirectMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { requestMagicLink } from "@/app/login/actions";

const originalAppUrl = process.env.APP_URL;

function formData(email: string) {
  const value = new FormData();
  value.set("email", email);
  return value;
}

beforeEach(() => {
  process.env.APP_URL = "http://localhost:3000";
  createClientMock.mockReset();
  redirectMock.mockClear();
});

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }
});

describe("requestMagicLink", () => {
  it("sends a magic-link request without allowing user creation", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    createClientMock.mockResolvedValue({ auth: { signInWithOtp } });

    await expect(requestMagicLink(formData("member@example.test"))).rejects.toThrow(
      "redirect:/login?sent=1",
    );

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "member@example.test",
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "http://localhost:3000/auth/confirm",
      },
    });
  });

  it("returns the same neutral response when Supabase rejects the request", async () => {
    const signInWithOtp = vi
      .fn()
      .mockResolvedValue({ data: {}, error: new Error("No user found") });
    createClientMock.mockResolvedValue({ auth: { signInWithOtp } });

    await expect(requestMagicLink(formData("unknown@example.test"))).rejects.toThrow(
      "redirect:/login?sent=1",
    );
  });

  it("rejects malformed email input before contacting Supabase", async () => {
    await expect(requestMagicLink(formData("not-an-email"))).rejects.toThrow(
      "redirect:/login?auth=invalid-email",
    );

    expect(createClientMock).not.toHaveBeenCalled();
  });
});
