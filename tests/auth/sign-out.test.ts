import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/auth/sign-out/route";

beforeEach(() => {
  createClientMock.mockReset();
});

describe("POST /auth/sign-out", () => {
  it("clears the Supabase session and redirects to login", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ auth: { signOut } });

    const response = await POST(
      new NextRequest("http://localhost:3000/auth/sign-out", {
        method: "POST",
      }),
    );

    expect(signOut).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
