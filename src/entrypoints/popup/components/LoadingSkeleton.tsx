export function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading conversations">
      {['s1', 's2', 's3', 's4', 's5'].map((id) => (
        <div key={id} className="rounded-xl p-3">
          <div className="flex items-start gap-3 pl-2">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
