import type { SyncProvider, ProviderConfig, SyncError, CloudSyncStatus } from './types'
import { syncCycle, pullOnly, pushOnly, type SyncCycleResult } from './engine'
import { syncLogger } from './utils'
import {
  getSyncState,
  updateSyncState,
  initializeSyncState,
  getDirtyConversations,
  getDirtyMessages,
} from '@/utils/db'
import { createRestProvider } from './providers/rest'

// ============================================================================
// Types
// ============================================================================

export interface SyncManagerConfig {
  /** Auto sync interval in milliseconds (default: 5 minutes) */
  autoSyncInterval?: number
  /** Maximum retry attempts */
  maxRetries?: number
  /** Retry delays in milliseconds */
  retryDelays?: number[]
  /** Whether to auto-resolve conflicts */
  autoResolveConflicts?: boolean
  /** Only sync on WiFi (for future mobile support) */
  wifiOnly?: boolean
}

export interface SyncManagerState {
  status: CloudSyncStatus
  lastSyncAt: number | null
  pendingChanges: number
  pendingConflicts: number
  lastError: string | null
  isOnline: boolean
  retryCount: number
  nextRetryAt: number | null
}

export type SyncEventType =
  | 'status_changed'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'conflict_detected'
  | 'online_changed'

export type SyncEventListener = (event: SyncEventType, data?: unknown) => void

// ============================================================================
// Sync Manager
// ============================================================================

class SyncManagerImpl {
  private provider: SyncProvider | null = null
  private config: Required<SyncManagerConfig>
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryCount = 0
  private listeners: Set<SyncEventListener> = new Set()
  private isSyncing = false

  constructor() {
    this.config = {
      autoSyncInterval: 5 * 60 * 1000, // 5 minutes
      maxRetries: 3,
      retryDelays: [5000, 30000, 120000], // 5s, 30s, 2min
      autoResolveConflicts: true,
      wifiOnly: false,
    }

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnlineChange(true))
      window.addEventListener('offline', () => this.handleOnlineChange(false))
    }
  }

  // ============ Configuration ============

  /**
   * Configure the sync manager
   */
  configure(config: Partial<SyncManagerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Initialize with a provider
   */
  async initialize(config: ProviderConfig): Promise<void> {
    // Initialize sync state if needed
    await initializeSyncState()

    // Create and connect provider
    if (config.type === 'rest') {
      this.provider = createRestProvider()
    } else {
      throw new Error(`Unsupported provider type: ${config.type}`)
    }

    await this.provider.connect(config)

    await updateSyncState({ status: 'idle' })
    this.emit('status_changed', 'idle')
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    this.stopAutoSync()
    this.cancelRetry()

    if (this.provider) {
      await this.provider.disconnect()
      this.provider = null
    }

    await updateSyncState({ status: 'disabled' })
    this.emit('status_changed', 'disabled')
  }

  /**
   * Check if sync is enabled and connected
   */
  isEnabled(): boolean {
    return this.provider?.isConnected() ?? false
  }

  // ============ Manual Sync ============

  /**
   * Perform a full sync cycle
   */
  async sync(): Promise<SyncCycleResult> {
    if (!this.provider) {
      throw new Error('Sync not initialized')
    }

    if (this.isSyncing) {
      throw new Error('Sync already in progress')
    }

    this.isSyncing = true
    this.cancelRetry()
    this.emit('sync_started')

    try {
      const result = await syncCycle(this.provider, {
        autoResolveConflicts: this.config.autoResolveConflicts,
      })

      if (result.success) {
        this.retryCount = 0
        this.emit('sync_completed', result)

        if (result.conflicts.length > 0) {
          this.emit('conflict_detected', result.conflicts)
        }
      } else {
        await this.handleSyncError(result.errors[0])
        this.emit('sync_failed', result.errors[0])
      }

      return result
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Quick pull from server
   */
  async pull(): Promise<{ success: boolean; pulled: number; error?: SyncError }> {
    if (!this.provider) {
      throw new Error('Sync not initialized')
    }

    return pullOnly(this.provider)
  }

  /**
   * Quick push to server
   */
  async push(): Promise<{ success: boolean; pushed: number; error?: SyncError }> {
    if (!this.provider) {
      throw new Error('Sync not initialized')
    }

    return pushOnly(this.provider)
  }

  // ============ Auto Sync ============

  /**
   * Start automatic sync
   */
  startAutoSync(interval?: number): void {
    this.stopAutoSync()

    const syncInterval = interval ?? this.config.autoSyncInterval

    this.syncTimer = setInterval(async () => {
      if (!this.isSyncing && this.isOnline()) {
        try {
          await this.sync()
        } catch (error) {
          syncLogger.error('Auto sync failed', error)
        }
      }
    }, syncInterval)
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  /**
   * Check if auto sync is running
   */
  isAutoSyncEnabled(): boolean {
    return this.syncTimer !== null
  }

  // ============ State ============

  /**
   * Get current sync state
   */
  async getState(): Promise<SyncManagerState> {
    const syncState = await getSyncState()
    const dirtyConversations = await getDirtyConversations()
    const dirtyMessages = await getDirtyMessages()

    return {
      status: syncState?.status ?? 'disabled',
      lastSyncAt: syncState?.lastPushAt ?? syncState?.lastPullAt ?? null,
      pendingChanges: dirtyConversations.length + dirtyMessages.length,
      pendingConflicts: syncState?.pendingConflicts ?? 0,
      lastError: syncState?.lastError ?? null,
      isOnline: this.isOnline(),
      retryCount: this.retryCount,
      nextRetryAt: this.getNextRetryTime(),
    }
  }

  /**
   * Check if there are pending changes
   */
  async hasPendingChanges(): Promise<boolean> {
    const dirtyConversations = await getDirtyConversations()
    const dirtyMessages = await getDirtyMessages()
    return dirtyConversations.length > 0 || dirtyMessages.length > 0
  }

  // ============ Events ============

  /**
   * Subscribe to sync events
   */
  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: SyncEventType, data?: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(event, data)
      } catch (error) {
        syncLogger.error('Event listener error', error)
      }
    }
  }

  // ============ Network ============

  private isOnline(): boolean {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  }

  private handleOnlineChange(online: boolean): void {
    this.emit('online_changed', online)

    if (online && this.provider) {
      // Trigger sync when coming back online
      this.sync().catch(error => {
        syncLogger.error('Sync after reconnect failed', error)
      })
    }
  }

  // ============ Retry ============

  private async handleSyncError(error?: SyncError): Promise<void> {
    if (!error?.recoverable) {
      this.retryCount = 0
      return
    }

    this.retryCount++

    if (this.retryCount > this.config.maxRetries) {
      this.retryCount = 0
      await updateSyncState({
        status: 'error',
        lastError: `Max retries exceeded: ${error.message}`,
        lastErrorAt: Date.now(),
      })
      return
    }

    const delay = error.retryAfter ?? this.config.retryDelays[this.retryCount - 1] ?? 120000

    await updateSyncState({
      status: 'error',
      lastError: `${error.message} (retry ${this.retryCount}/${this.config.maxRetries} in ${Math.round(delay / 1000)}s)`,
      lastErrorAt: Date.now(),
    })

    this.scheduleRetry(delay)
  }

  private scheduleRetry(delay: number): void {
    this.cancelRetry()

    this.retryTimer = setTimeout(async () => {
      if (this.isOnline() && this.provider) {
        try {
          await this.sync()
        } catch (error) {
          syncLogger.error('Retry failed', error)
        }
      }
    }, delay)
  }

  private cancelRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private getNextRetryTime(): number | null {
    if (!this.retryTimer || this.retryCount === 0) return null
    const delay = this.config.retryDelays[this.retryCount - 1] ?? 120000
    return Date.now() + delay
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const syncManager = new SyncManagerImpl()

// Re-export for convenience
export { SyncManagerImpl }
