import type { ProviderConfig, PullResult, PushResult, SyncProvider, SyncRecord } from '../types'

// ============================================================================
// Mock Provider - For Testing and Development
// ============================================================================

/**
 * A mock sync provider that stores data in memory.
 * Useful for testing and development without a real backend.
 */
export class MockSyncProvider implements SyncProvider {
  readonly name = 'Mock Provider'
  readonly type = 'rest' as const

  private connected = false
  private records: Map<string, SyncRecord> = new Map()
  private pushHistory: SyncRecord[][] = []
  private cursor = 0

  // Configurable behavior for testing
  public simulateNetworkError = false
  public simulateConflict = false
  public simulateLatency = 0

  // ============ Connection Management ============

  async connect(_config: ProviderConfig): Promise<void> {
    if (this.simulateNetworkError) {
      throw new Error('Simulated network error')
    }
    await this.delay()
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  // ============ Pull ============

  async pull(cursor?: string | null): Promise<PullResult> {
    if (this.simulateNetworkError) {
      return {
        success: false,
        records: [],
        cursor: null,
        hasMore: false,
        error: {
          code: 'network_error',
          message: 'Simulated network error',
          recoverable: true,
        },
      }
    }

    await this.delay()

    const startIndex = cursor ? Number.parseInt(cursor, 10) : 0
    const allRecords = Array.from(this.records.values())
    const pageSize = 50
    const pageRecords = allRecords.slice(startIndex, startIndex + pageSize)
    const newCursor = startIndex + pageRecords.length

    return {
      success: true,
      records: pageRecords,
      cursor: newCursor < allRecords.length ? String(newCursor) : null,
      hasMore: newCursor < allRecords.length,
    }
  }

  // ============ Push ============

  async push(changes: SyncRecord[]): Promise<PushResult> {
    if (this.simulateNetworkError) {
      return {
        success: false,
        applied: [],
        failed: [],
        error: {
          code: 'network_error',
          message: 'Simulated network error',
          recoverable: true,
        },
      }
    }

    await this.delay()

    const applied: string[] = []
    const failed: PushResult['failed'] = []

    for (const record of changes) {
      if (this.simulateConflict && this.records.has(record.id)) {
        failed.push({
          id: record.id,
          reason: 'conflict',
          message: 'Simulated conflict',
          serverVersion: this.records.get(record.id),
        })
      }
      else {
        this.records.set(record.id, record)
        applied.push(record.id)
      }
    }

    this.pushHistory.push(changes)
    this.cursor++

    return {
      success: true,
      applied,
      failed,
    }
  }

  // ============ Test Helpers ============

  /**
   * Add records directly to the mock server (simulates server-side changes)
   */
  addServerRecords(records: SyncRecord[]): void {
    for (const record of records) {
      this.records.set(record.id, record)
    }
  }

  /**
   * Get all records stored in the mock server
   */
  getServerRecords(): SyncRecord[] {
    return Array.from(this.records.values())
  }

  /**
   * Get push history for verification
   */
  getPushHistory(): SyncRecord[][] {
    return this.pushHistory
  }

  /**
   * Clear all data
   */
  reset(): void {
    this.records.clear()
    this.pushHistory = []
    this.cursor = 0
    this.simulateNetworkError = false
    this.simulateConflict = false
    this.simulateLatency = 0
  }

  // ============ Private ============

  private async delay(): Promise<void> {
    if (this.simulateLatency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulateLatency))
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMockProvider(): MockSyncProvider {
  return new MockSyncProvider()
}
