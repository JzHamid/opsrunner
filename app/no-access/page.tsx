export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6">
      <section className="w-full max-w-md rounded-[18px] bg-surface/95 p-2 shadow-[0_24px_70px_rgba(21,31,28,0.12),0_1px_2px_rgba(21,31,28,0.06)] ring-1 ring-black/[0.04]">
        <div className="rounded-[12px] bg-[#fcfdfc] px-6 py-8 sm:px-8 sm:py-9">
          <div className="flex size-10 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,23,42,0.16)]">
            OR
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Access required
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">
            This account is not connected to a workspace.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Contact your workspace administrator to request access.
          </p>

          <form action="/auth/sign-out" method="post" className="mt-8">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-line/90 bg-white px-5 text-sm font-semibold text-foreground transition hover:border-foreground/25 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/10"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
