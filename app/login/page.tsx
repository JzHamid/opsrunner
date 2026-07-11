import { requestMagicLink } from "@/app/login/actions";

type LoginPageProps = {
  searchParams: Promise<{
    auth?: string;
    sent?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { auth, sent } = await searchParams;
  const isSent = sent === "1";
  const message =
    auth === "invalid-email"
      ? "Enter a valid work email."
      : auth === "unavailable"
        ? "Sign-in is temporarily unavailable. Please try again later."
        : auth === "invalid-link"
          ? "That sign-in link is invalid or has expired."
          : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6">
      <section className="w-full max-w-md rounded-[18px] bg-surface/95 p-2 shadow-[0_24px_70px_rgba(21,31,28,0.12),0_1px_2px_rgba(21,31,28,0.06)] ring-1 ring-black/[0.04]">
        <div className="rounded-[12px] bg-[#fcfdfc] px-6 py-8 sm:px-8 sm:py-9">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,23,42,0.16)]">
              OR
            </div>
            <p className="text-sm font-semibold">OpsRunner</p>
          </div>

          <div className="mt-9">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Internal access
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">
              Continue to your workspace.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Enter your work email and we&apos;ll send a secure sign-in link.
            </p>
          </div>

          {isSent ? (
            <p className="mt-6 rounded-lg border border-accent/20 bg-[#f4faf6] px-4 py-3 text-sm leading-6 text-foreground/80">
              If your account has access, a sign-in link is on its way.
            </p>
          ) : null}

          {message ? (
            <p className="mt-6 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm leading-6 text-danger">
              {message}
            </p>
          ) : null}

          <form action={requestMagicLink} className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold">Work email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-2 h-12 w-full rounded-xl border border-line/90 bg-white px-4 text-[15px] text-foreground shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/10"
              />
            </label>

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(27,117,83,0.22)] transition hover:bg-[#156344] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20"
            >
              Send sign-in link
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
