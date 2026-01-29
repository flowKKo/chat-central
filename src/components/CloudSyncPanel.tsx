import { useAtomValue, useSetAtom } from 'jotai'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Loader2,
  RefreshCw,
  WifiOff,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  autoSyncEnabledAtom,
  autoSyncIntervalAtom,
  cloudSyncErrorAtom,
  cloudSyncStatusAtom,
  connectCloudAtom,
  disconnectCloudAtom,
  initializeCloudSyncAtom,
  isCloudConnectedAtom,
  isSyncingAtom,
  lastSyncResultAtom,
  lastSyncTimeAgoAtom,
  performSyncAtom,
  toggleAutoSyncAtom,
} from '@/utils/atoms/cloud-sync'
import { cn } from '@/utils/cn'
import { SettingsSection } from './ui/SettingsSection'

export function CloudSyncPanel() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Atoms
  const isConnected = useAtomValue(isCloudConnectedAtom)
  const syncStatus = useAtomValue(cloudSyncStatusAtom)
  const lastSyncTimeAgo = useAtomValue(lastSyncTimeAgoAtom)
  const syncError = useAtomValue(cloudSyncErrorAtom)
  const isSyncing = useAtomValue(isSyncingAtom)
  const lastResult = useAtomValue(lastSyncResultAtom)
  const autoSyncEnabled = useAtomValue(autoSyncEnabledAtom)
  const autoSyncInterval = useAtomValue(autoSyncIntervalAtom)

  // Actions
  const connect = useSetAtom(connectCloudAtom)
  const disconnect = useSetAtom(disconnectCloudAtom)
  const performSync = useSetAtom(performSyncAtom)
  const toggleAutoSync = useSetAtom(toggleAutoSyncAtom)
  const initializeCloudSync = useSetAtom(initializeCloudSyncAtom)

  // State for connection in progress
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Initialize cloud sync state on mount
  useEffect(() => {
    initializeCloudSync()
  }, [initializeCloudSync])

  const handleConnect = async () => {
    setIsConnecting(true)
    setConnectError(null)
    try {
      await connect('google-drive')
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : 'Connection failed')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect from cloud sync? Your local data will be preserved.')) {
      return
    }
    await disconnect()
  }

  const handleSync = async () => {
    await performSync()
  }

  return (
    <SettingsSection
      icon={Cloud}
      iconColor="text-sky-500"
      iconBgColor="bg-sky-500/10"
      title="Cloud Sync"
      description="Sync your conversations across devices"
    >
      {/* Offline Warning */}
      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-500/10 p-3">
          <WifiOff className="h-4 w-4 flex-shrink-0 text-amber-500" />
          <p className="text-sm text-amber-600 dark:text-amber-400">
            You're offline. Sync will resume when connected.
          </p>
        </div>
      )}

      {!isConnected && (
        // Not Connected State
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-4">
            <CloudOff className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">Not connected</p>
              <p className="text-sm text-muted-foreground">
                Connect to sync your data with Google Drive
              </p>
            </div>
          </div>

          {/* Connect Error */}
          {connectError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-400">{connectError}</p>
            </div>
          )}

          {/* Google Connect Button */}
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            className={cn(
              'flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 py-3 font-medium transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700',
              isConnecting && 'cursor-not-allowed opacity-50'
            )}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <GoogleIcon className="h-5 w-5" />
                Connect with Google
              </>
            )}
          </button>
        </div>
      )}

      {isConnected && (
        // Connected State
        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  Connected to Google Drive
                </p>
                {lastSyncTimeAgo && (
                  <p className="text-sm text-muted-foreground">
                    Last synced:
                    {lastSyncTimeAgo}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sync Error */}
          {syncError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <div className="text-sm text-red-600 dark:text-red-400">
                <p>{syncError}</p>
                {lastResult?.errorCategory === 'auth' && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="mt-2 text-xs underline hover:no-underline"
                  >
                    Reconnect account
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sync Success */}
          {syncStatus === 'success' && lastResult && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              <div className="text-sm text-emerald-600 dark:text-emerald-400">
                <p className="font-medium">Sync completed</p>
                {(lastResult.stats.conversationsUploaded > 0 ||
                  lastResult.stats.conversationsDownloaded > 0) && (
                  <p className="text-muted-foreground">
                    {lastResult.stats.conversationsUploaded > 0 &&
                      `Uploaded ${lastResult.stats.conversationsUploaded} conversations. `}
                    {lastResult.stats.conversationsDownloaded > 0 &&
                      `Downloaded ${lastResult.stats.conversationsDownloaded} conversations.`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing || !isOnline}
              className={cn(
                'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                (isSyncing || !isOnline) && 'cursor-not-allowed opacity-50'
              )}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sync Now
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="cursor-pointer rounded-xl border border-border px-4 py-2.5 font-medium transition-colors hover:bg-muted"
            >
              Disconnect
            </button>
          </div>

          {/* Auto-sync Toggle */}
          <div className="flex items-center justify-between rounded-xl bg-muted/30 p-4">
            <div>
              <p className="font-medium">Auto-sync</p>
              <p className="text-sm text-muted-foreground">
                Automatically sync every {autoSyncInterval} minute
                {autoSyncInterval === 1 ? '' : 's'}
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={() => toggleAutoSync()}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50" />
            </label>
          </div>
        </div>
      )}

      {/* Privacy Note */}
      <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Cloud className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <p>
          Your data is stored in your own Google Drive app folder. Only this extension can access
          it.
        </p>
      </div>
    </SettingsSection>
  )
}

// Google Icon Component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
