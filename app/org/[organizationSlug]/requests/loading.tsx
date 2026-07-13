export default function RequestsLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl animate-pulse px-4 py-8 sm:px-8 sm:py-12 lg:px-10">
      <div className="h-4 w-20 rounded bg-line/70" />
      <div className="mt-4 h-9 w-44 rounded bg-line/70" />
      <div className="mt-10 h-16 rounded-lg bg-line/50" />
      <div className="mt-7 overflow-hidden rounded-lg bg-surface ring-1 ring-black/[0.04]">
        {[0, 1, 2].map((item) => (
          <div key={item} className="border-b border-line/60 px-6 py-6 last:border-0">
            <div className="h-4 w-2/5 rounded bg-line/70" />
            <div className="mt-3 h-3 w-3/5 rounded bg-line/50" />
          </div>
        ))}
      </div>
    </main>
  );
}
