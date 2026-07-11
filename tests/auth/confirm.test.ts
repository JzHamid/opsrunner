import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { GET } from "@/app/auth/confirm/route";

beforeEach(() => {
  createClientMock.mockReset();
});

describe("GET /auth/confirm", () => {
  it("rejects missing or unsupported OTP types without calling Supabase", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=token&type=recovery",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?auth=invalid-link",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it.each(["email", "invite"]) (
    "verifies %s token hashes and redirects to the root route",
    async (type) => {
      const verifyOtp = vi.fn().mockResolvedValue({ error: null });
      createClientMock.mockResolvedValue({ auth: { verifyOtp } });

      const response = await GET(
        new NextRequest(
          `http://localhost:3000/auth/confirm?token_hash=token-value&type=${type}`,
        ),
      );

      expect(verifyOtp).toHaveBeenCalledWith({
        token_hash: "token-value",
        type,
      });
      expect(response.headers.get("location")).toBe("http://localhost:3000/");
    },
  );

  it("returns a neutral invalid-link response when verification fails", async () => {
    const verifyOtp = vi
      .fn()
      .mockResolvedValue({ error: new Error("Expired token") });
    createClientMock.mockResolvedValue({ auth: { verifyOtp } });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=token&type=email",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?auth=invalid-link",
    );
  });
});
