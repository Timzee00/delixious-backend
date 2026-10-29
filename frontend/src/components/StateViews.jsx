export function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="ticket animate-pulse">
          <div className="h-36 w-full overflow-hidden rounded-t-xl bg-hairline" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 rounded bg-hairline" />
            <div className="h-3 w-1/3 rounded bg-hairline" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message }) {
  return (
    <div className="ticket p-10 text-center">
      <p className="text-ink-soft">{message}</p>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="ticket border-danger/30 p-10 text-center">
      <p className="text-danger">{message}</p>
    </div>
  );
}
