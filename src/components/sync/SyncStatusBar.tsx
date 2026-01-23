import { useAtom } from 'jotai'
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Settings,
  Loader2,
} from 'lucide-react'
import {
  syncUIStateAtom,
  syncSettingsAtom,
  syncStatusTextAtom,
  triggerSyncAtom,
  syncSettingsOpenAtom,
  hasConflictsAtom,
  conflictResolverOpenAtom,
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
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        onClick={() => setSyncSettingsOpen(true)}
        title="Enable cloud sync"
      >
        <CloudOff className="w-4 h-4" />
        <span>Sync disabled</span>
      </button>
    )
  }

  const getStatusIcon = () => {
    if (uiState.isSyncing) {
      return <Loader2 className="w-4 h-4 animate-spin" />
    }
    if (!uiState.isOnline) {
      return <CloudOff className="w-4 h-4 text-muted-foreground" />
    }
    if (uiState.lastError) {
      return <AlertCircle className="w-4 h-4 text-destructive" />
    }
    if (hasConflicts) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />
    }
    if (uiState.pendingChanges > 0) {
      return <Cloud className="w-4 h-4 text-blue-500" />
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />
  }

  const getStatusColor = () => {
    if (uiState.isSyncing) return 'text-blue-500'
    if (!uiState.isOnline) return 'text-muted-foreground'
    if (uiState.lastError) return 'text-destructive'
    if (hasConflicts) return 'text-yellow-500'
    if (uiState.pendingChanges > 0) return 'text-blue-500'
    return 'text-green-500'
  }

  return (
    <div className="flex items-center gap-1">
      {/* Status indicator */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-xs rounded-md',
          getStatusColor()
        )}
        title={uiState.lastError ?? statusText}
      >
        {getStatusIcon()}
        <span className="max-w-[120px] truncate">{statusText}</span>
      </div>

      {/* Conflict badge */}
      {hasConflicts && (
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition-colors"
          onClick={() => setConflictResolverOpen(true)}
          title="Resolve conflicts"
        >
          <AlertCircle className="w-3 h-3" />
          <span>{uiState.pendingConflicts}</span>
        </button>
      )}

      {/* Sync button */}
      <button
        className="p-1.5 hover:bg-muted rounded-md transition-colors disabled:opacity-50"
        onClick={() => triggerSync()}
        disabled={uiState.isSyncing || !uiState.isOnline}
        title="Sync now"
      >
        <RefreshCw
          className={cn('w-4 h-4', uiState.isSyncing && 'animate-spin')}
        />
      </button>

      {/* Settings button */}
      <button
        className="p-1.5 hover:bg-muted rounded-md transition-colors"
        onClick={() => setSyncSettingsOpen(true)}
        title="Sync settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  )
}
