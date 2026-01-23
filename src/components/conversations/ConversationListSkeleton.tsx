export function ConversationListSkeleton() {
  return (
    <div className="divide-y divide-border/50" aria-busy="true" aria-label="Loading">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="p-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 skeleton rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 skeleton rounded" />
              <div className="h-3 w-1/2 skeleton rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
