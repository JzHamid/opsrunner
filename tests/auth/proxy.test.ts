import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { createServerClientMock, getAuthAccessMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getAuthAccessMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/auth/access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/access")>();

  return {
    ...actual,
    getAuthAccess: getAuthAccessMock,
  };
});

import {
  copyAuthResponseState,
  updateSession,
} from "@/lib/supabase/proxy";

beforeEach(() => {
  createServerClientMock.mockReset();
  getAuthAccessMock.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

describe("Supabase proxy session handling", () => {
  it("copies refreshed cookies and cache headers to redirects", () => {
    const source = NextResponse.next();
    source.cookies.set("sb-access-token", "refreshed", { httpOnly: true });
    source.headers.set("cache-control", "private, no-store");
    source.headers.set("pragma", "no-cache");
    const destination = NextResponse.redirect("http://localhost:3000/login");

    copyAuthResponseState(source, destination);

    expect(destination.cookies.get("sb-access-token")?.value).toBe("refreshed");
    expect(destination.headers.get("cache-control")).toBe("private, no-store");
    expect(destination.headers.get("pragma")).toBe("no-cache");
  });

  it("updates request and response cookies before evaluating verified access", async () => {
    getAuthAccessMock.mockResolvedValue({ kind: "unauthenticated" });
    createServerClientMock.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            setAll: (
              cookies: Array<{
                name: string;
                value: string;
                options: Record<string, unknown>;
              }>,
              headers: Record<string, string>,
            ) => void;
          };
        },
      ) => {
        options.cookies.setAll(
          [
            {
              name: "sb-access-token",
              value: "refreshed",
              options: { httpOnly: true },
            },
          ],
          { "cache-control": "private, no-store" },
        );

        return {};
      },
    );
    const request = new NextRequest("http://localhost:3000/");

    const { access, response } = await updateSession(request);

    expect(access).toEqual({ kind: "unauthenticated" });
    expect(request.cookies.get("sb-access-token")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-access-token")?.value).toBe("refreshed");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
