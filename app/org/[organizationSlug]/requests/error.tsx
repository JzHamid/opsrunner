"use client";

export default function RequestsError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16 sm:px-8">
      <section className="w-full rounded-lg bg-surface px-6 py-10 text-center shadow-[0_12px_32px_rgba(21,31,28,0.05)] ring-1 ring-black/[0.04]">
        <h1 className="text-xl font-semibold">Requests could not be loaded.</h1>
        <p className="mt-2 text-sm text-muted">Try again in a moment.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-white transition hover:bg-[#27312e] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/10"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
