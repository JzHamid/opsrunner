import Link from "next/link";

type AppShellProps = {
  children: React.ReactNode;
  organizationName: string;
  organizationSlug: string;
};

export function AppShell({
  children,
  organizationName,
  organizationSlug,
}: AppShellProps) {
  const runPath = `/org/${encodeURIComponent(organizationSlug)}/run`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line/70 bg-surface/90">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8 lg:px-10">
          <Link
            href={runPath}
            className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-white shadow-[0_8px_20px_rgba(15,23,42,0.14)]">
              OR
            </span>
            <span>
              <span className="block text-sm font-semibold">OpsRunner</span>
              <span className="block max-w-48 truncate text-xs text-muted">
                {organizationName}
              </span>
            </span>
          </Link>

          <nav className="order-3 flex w-full items-center border-t border-line/60 pt-2 sm:order-none sm:w-auto sm:border-0 sm:pt-0">
            <Link
              href={runPath}
              aria-current="page"
              className="border-b-2 border-accent px-1 py-2 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
            >
              Run
            </Link>
          </nav>

          <form
            action="/auth/sign-out"
            method="post"
            className="ml-auto self-center"
          >
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted outline-none transition hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/20"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {children}
    </div>
  );
}
