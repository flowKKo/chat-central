import { useAtom } from 'jotai'
import {
  AlertCircle,
  CheckCircle,
  Cloud,
  CloudOff,
  Loader2,
  RefreshCw,
  Settings,
} from 'lucide-react'
import {
  conflictResolverOpenAtom,
  hasConflictsAtom,
  syncSettingsAtom,
  syncSettingsOpenAtom,
  syncStatusTextAtom,
  syncUIStateAtom,
  triggerSyncAtom,
} from '@/utils/atoms/sync'
import { cn } from '@/utils/cn'

export function SyncStatusBar() {
  const [uiState] = useAtom(syncUIStateAtom)
  const [settings] = useAtom(syncSettingsAtom)
  const [statusText] = useAtom(syncStatusTextAtom)
  const [, triggerSync] = useAtom(triggerSyncAtom)
  const [, setSyncSettingsOpen] = useAtom(syncSettingsOpenAtom)
  const [hasConflicts] = useAtom(hasConflictsAtom)
  const [, setConflictResolverOpen] = useAtom(conflictResolverOpenAtom)

  if (!settings.enabled) {
    return (
      <button
        className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        onClick={() => setSyncSettingsOpen(true)}
        title="Enable cloud sync"
      >
        <CloudOff className="h-3.5 w-3.5" />
        <span>Sync off</span>
      </button>
    )
  }

  const getStatusIcon = () => {
    if (uiState.isSyncing) {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
    }
    if (!uiState.isOnline) {
      return <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
    }
    if (uiState.lastError) {
      return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
    }
    if (hasConflicts) {
      return <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
    }
    if (uiState.pendingChanges > 0) {
      return <Cloud className="h-3.5 w-3.5 text-blue-400" />
    }
    return <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
  }

  const getStatusColor = () => {
    if (uiState.isSyncing) return 'text-blue-400'
    if (!uiState.isOnline) return 'text-muted-foreground'
    if (uiState.lastError) return 'text-red-400'
    if (hasConflicts) return 'text-amber-400'
    if (uiState.pendingChanges > 0) return 'text-blue-400'
    return 'text-emerald-400'
  }

  return (
    <div className="flex items-center gap-1">
      {/* Status indicator */}
      <div
        className={cn('flex items-center gap-1.5 text-xs', getStatusColor())}
        title={uiState.lastError ?? statusText}
      >
        {getStatusIcon()}
        <span className="max-w-[80px] truncate opacity-80">{statusText}</span>
      </div>

      {/* Conflict badge */}
      {hasConflicts && (
        <button
          className="flex cursor-pointer items-center gap-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-500/30"
          onClick={() => setConflictResolverOpen(true)}
          title="Resolve conflicts"
        >
          <AlertCircle className="h-3 w-3" />
          <span>{uiState.pendingConflicts}</span>
        </button>
      )}

      {/* Sync button */}
      <button
        className="cursor-pointer rounded-md p-1 transition-colors hover:bg-muted/50 disabled:opacity-40"
        onClick={() => triggerSync()}
        disabled={uiState.isSyncing || !uiState.isOnline}
        title="Sync now"
      >
        <RefreshCw
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground',
            uiState.isSyncing && 'animate-spin text-blue-400'
          )}
        />
      </button>

      {/* Settings button */}
      <button
        className="cursor-pointer rounded-md p-1 transition-colors hover:bg-muted/50"
        onClick={() => setSyncSettingsOpen(true)}
        title="Sync settings"
      >
        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}
