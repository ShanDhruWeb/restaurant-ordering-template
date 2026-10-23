export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <div className="skeleton h-12 w-12 rounded-card" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-6 w-1/2 rounded-card" />
          <div className="skeleton h-4 w-3/4 rounded-card" />
        </div>
      </div>
      <div className="skeleton h-11 rounded-pill" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3 py-2">
          <div className="flex-1 space-y-2">
            <div className="skeleton h-5 w-2/3 rounded-card" />
            <div className="skeleton h-4 w-1/4 rounded-card" />
            <div className="skeleton h-4 w-full rounded-card" />
          </div>
          <div className="skeleton h-24 w-28 rounded-card" />
        </div>
      ))}
    </main>
  );
}
