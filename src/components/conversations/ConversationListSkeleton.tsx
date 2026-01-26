export function ConversationListSkeleton() {
  return (
    <div className="divide-y divide-border/50" aria-busy="true" aria-label="Loading">
      {['s1', 's2', 's3', 's4', 's5', 's6'].map((id) => (
        <div key={id} className="p-3.5">
          <div className="flex items-center gap-3">
            <div className="skeleton h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
