import { useAtom } from 'jotai'
import { X, AlertTriangle, ChevronDown, ChevronUp, Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { SyncConflict, ConflictResolutionAction } from '@/utils/sync/types'
import {
  conflictResolverOpenAtom,
  refreshSyncStateAtom,
  syncConflictsAtom,
} from '@/utils/atoms/sync'
import { cn } from '@/utils/cn'
import { applyConflictResolution } from '@/utils/sync/engine'

export function ConflictResolverModal() {
  const [isOpen, setIsOpen] = useAtom(conflictResolverOpenAtom)
  const [conflicts, setConflicts] = useAtom(syncConflictsAtom)
  const [, refreshSyncState] = useAtom(refreshSyncStateAtom)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  if (!isOpen || conflicts.length === 0) return null

  const handleResolve = async (conflict: SyncConflict, resolution: ConflictResolutionAction) => {
    setResolvingId(conflict.id)
    try {
      await applyConflictResolution(conflict.id, resolution)

      // Remove from local state
      setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))

      // Refresh sync state
      await refreshSyncState()

      // Close if no more conflicts
      if (conflicts.length === 1) {
        setIsOpen(false)
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
    } finally {
      setResolvingId(null)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-background shadow-lg">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Resolve Conflicts ({conflicts.length})</h2>
          </div>
          <button
            type="button"
            className="rounded-md p-1 transition-colors hover:bg-muted"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {conflicts.map((conflict) => (
            <ConflictItem
              key={conflict.id}
              conflict={conflict}
              isExpanded={expandedId === conflict.id}
              isResolving={resolvingId === conflict.id}
              onToggle={() => setExpandedId((prev) => (prev === conflict.id ? null : conflict.id))}
              onResolve={(resolution) => handleResolve(conflict, resolution)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-border p-4">
          <p className="text-sm text-muted-foreground">
            Choose which version to keep for each conflict
          </p>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

interface ConflictItemProps {
  conflict: SyncConflict
  isExpanded: boolean
  isResolving: boolean
  onToggle: () => void
  onResolve: (resolution: ConflictResolutionAction) => void
}

function ConflictItem({
  conflict,
  isExpanded,
  isResolving,
  onToggle,
  onResolve,
}: ConflictItemProps) {
  const localVersion = conflict.localVersion as Record<string, unknown> | undefined
  const remoteVersion = conflict.remoteVersion as Record<string, unknown> | undefined
  const localData = (localVersion?.data ?? localVersion) as Record<string, unknown> | undefined
  const remoteData = (remoteVersion?.data ?? remoteVersion) as Record<string, unknown> | undefined

  const localTitle = (localData?.title as string) ?? 'Unknown'

  const localModifiedAt = localVersion?.modifiedAt
  const localModified =
    typeof localModifiedAt === 'number' ? new Date(localModifiedAt).toLocaleString() : 'Unknown'
  const remoteModifiedAt = remoteVersion?.modifiedAt
  const remoteModified =
    typeof remoteModifiedAt === 'number' ? new Date(remoteModifiedAt).toLocaleString() : 'Unknown'

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between p-3 transition-colors hover:bg-muted/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <div className="text-left">
            <p className="text-sm font-medium">
              {conflict.entityType}:{localTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              Field: {conflict.field ?? 'multiple fields'}
            </p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4 border-t border-border p-3">
          {/* Comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Local Version */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-600">Local (This Device)</span>
                <span className="text-xs text-muted-foreground">{localModified}</span>
              </div>
              <div className="rounded-md bg-blue-50 p-2 text-sm">
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(localData, null, 2)}
                </pre>
              </div>
            </div>

            {/* Remote Version */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-600">Remote (Server)</span>
                <span className="text-xs text-muted-foreground">{remoteModified}</span>
              </div>
              <div className="rounded-md bg-green-50 p-2 text-sm">
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(remoteData, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors',
                'border border-blue-300 text-blue-700 hover:bg-blue-50',
                'disabled:opacity-50'
              )}
              onClick={() => onResolve('local')}
              disabled={isResolving}
            >
              {isResolving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Keep Local
            </button>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors',
                'border border-green-300 text-green-700 hover:bg-green-50',
                'disabled:opacity-50'
              )}
              onClick={() => onResolve('remote')}
              disabled={isResolving}
            >
              {isResolving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Keep Remote
            </button>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors',
                'border border-purple-300 text-purple-700 hover:bg-purple-50',
                'disabled:opacity-50'
              )}
              onClick={() => onResolve('merged')}
              disabled={isResolving}
            >
              {isResolving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Auto Merge
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
