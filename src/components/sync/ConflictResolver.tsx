import { useState } from 'react'
import { useAtom } from 'jotai'
import {
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
} from 'lucide-react'
import {
  syncConflictsAtom,
  conflictResolverOpenAtom,
  refreshSyncStateAtom,
} from '@/utils/atoms/sync'
import { applyConflictResolution } from '@/utils/sync/engine'
import type { SyncConflict, ConflictResolutionAction } from '@/utils/sync/types'
import { cn } from '@/utils/cn'

export function ConflictResolverModal() {
  const [isOpen, setIsOpen] = useAtom(conflictResolverOpenAtom)
  const [conflicts, setConflicts] = useAtom(syncConflictsAtom)
  const [, refreshSyncState] = useAtom(refreshSyncStateAtom)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  if (!isOpen || conflicts.length === 0) return null

  const handleResolve = async (
    conflict: SyncConflict,
    resolution: ConflictResolutionAction
  ) => {
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
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">
              Resolve Conflicts ({conflicts.length})
            </h2>
          </div>
          <button
            className="p-1 hover:bg-muted rounded-md transition-colors"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {conflicts.map((conflict) => (
            <ConflictItem
              key={conflict.id}
              conflict={conflict}
              isExpanded={expandedId === conflict.id}
              isResolving={resolvingId === conflict.id}
              onToggle={() =>
                setExpandedId((prev) =>
                  prev === conflict.id ? null : conflict.id
                )
              }
              onResolve={(resolution) => handleResolve(conflict, resolution)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border flex-shrink-0">
          <p className="text-sm text-muted-foreground">
            Choose which version to keep for each conflict
          </p>
          <button
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
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
  const localModified = typeof localModifiedAt === 'number'
    ? new Date(localModifiedAt).toLocaleString()
    : 'Unknown'
  const remoteModifiedAt = remoteVersion?.modifiedAt
  const remoteModified = typeof remoteModifiedAt === 'number'
    ? new Date(remoteModifiedAt).toLocaleString()
    : 'Unknown'

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <div className="text-left">
            <p className="font-medium text-sm">
              {conflict.entityType}: {localTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              Field: {conflict.field ?? 'multiple fields'}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-3 space-y-4">
          {/* Comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Local Version */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-600">
                  Local (This Device)
                </span>
                <span className="text-xs text-muted-foreground">
                  {localModified}
                </span>
              </div>
              <div className="p-2 bg-blue-50 rounded-md text-sm">
                <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-32">
                  {JSON.stringify(localData, null, 2)}
                </pre>
              </div>
            </div>

            {/* Remote Version */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-600">
                  Remote (Server)
                </span>
                <span className="text-xs text-muted-foreground">
                  {remoteModified}
                </span>
              </div>
              <div className="p-2 bg-green-50 rounded-md text-sm">
                <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-32">
                  {JSON.stringify(remoteData, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                'border border-blue-300 text-blue-700 hover:bg-blue-50',
                'disabled:opacity-50'
              )}
              onClick={() => onResolve('local')}
              disabled={isResolving}
            >
              {isResolving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Keep Local
            </button>
            <button
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                'border border-green-300 text-green-700 hover:bg-green-50',
                'disabled:opacity-50'
              )}
              onClick={() => onResolve('remote')}
              disabled={isResolving}
            >
              {isResolving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Keep Remote
            </button>
            <button
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                'border border-purple-300 text-purple-700 hover:bg-purple-50',
                'disabled:opacity-50'
              )}
              onClick={() => onResolve('merged')}
              disabled={isResolving}
            >
              {isResolving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Auto Merge
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
