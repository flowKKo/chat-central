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
        className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
        onClick={() => setSyncSettingsOpen(true)}
        title="Enable cloud sync"
      >
        <CloudOff className="w-3.5 h-3.5" />
        <span>Sync off</span>
      </button>
    )
  }

  const getStatusIcon = () => {
    if (uiState.isSyncing) {
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
    }
    if (!uiState.isOnline) {
      return <CloudOff className="w-3.5 h-3.5 text-muted-foreground" />
    }
    if (uiState.lastError) {
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />
    }
    if (hasConflicts) {
      return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
    }
    if (uiState.pendingChanges > 0) {
      return <Cloud className="w-3.5 h-3.5 text-blue-400" />
    }
    return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
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
        className={cn(
          'flex items-center gap-1.5 text-xs',
          getStatusColor()
        )}
        title={uiState.lastError ?? statusText}
      >
        {getStatusIcon()}
        <span className="max-w-[80px] truncate opacity-80">{statusText}</span>
      </div>

      {/* Conflict badge */}
      {hasConflicts && (
        <button
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded-md hover:bg-amber-500/30 transition-colors cursor-pointer"
          onClick={() => setConflictResolverOpen(true)}
          title="Resolve conflicts"
        >
          <AlertCircle className="w-3 h-3" />
          <span>{uiState.pendingConflicts}</span>
        </button>
      )}

      {/* Sync button */}
      <button
        className="p-1 hover:bg-muted/50 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
        onClick={() => triggerSync()}
        disabled={uiState.isSyncing || !uiState.isOnline}
        title="Sync now"
      >
        <RefreshCw
          className={cn('w-3.5 h-3.5 text-muted-foreground', uiState.isSyncing && 'animate-spin text-blue-400')}
        />
      </button>

      {/* Settings button */}
      <button
        className="p-1 hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
        onClick={() => setSyncSettingsOpen(true)}
        title="Sync settings"
      >
        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}
