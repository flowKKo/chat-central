import { Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/utils/cn'
import { clearAllData } from '@/utils/db'

export function DangerZoneSettings() {
  const [isClearing, setIsClearing] = useState(false)

  const handleClearAll = async () => {
    if (
      !confirm('Are you sure you want to delete all synced conversations? This cannot be undone.')
    ) {
      return
    }
    setIsClearing(true)
    try {
      await clearAllData()
      window.location.reload()
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <section className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10">
            <Trash2 className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-semibold text-red-600 dark:text-red-400">
              Delete All Data
            </h2>
            <p className="text-xs text-muted-foreground">
              Permanently delete all conversations. This cannot be undone.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600',
            isClearing && 'cursor-not-allowed opacity-50'
          )}
          onClick={handleClearAll}
          disabled={isClearing}
        >
          {isClearing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            'Delete All'
          )}
        </button>
      </div>
    </section>
  )
}
