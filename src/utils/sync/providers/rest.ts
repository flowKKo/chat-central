import type {
  ProviderConfig,
  PullResult,
  PushResult,
  SyncError,
  SyncProvider,
  SyncRecord,
} from '../types'

// ============================================================================
// REST Provider Configuration
// ============================================================================

export interface RestProviderConfig extends ProviderConfig {
  type: 'rest'
  endpoint: string
  apiKey?: string
  timeout?: number
}

// ============================================================================
// REST Provider Implementation
// ============================================================================

export class RestSyncProvider implements SyncProvider {
  readonly name = 'REST API'
  readonly type = 'rest' as const

  private config: RestProviderConfig | null = null
  private connected = false

  // ============ Connection Management ============

  async connect(config: ProviderConfig): Promise<void> {
    if (config.type !== 'rest') {
      throw new Error('Invalid config type for REST provider')
    }

    const restConfig = config as RestProviderConfig
    if (!restConfig.endpoint) {
      throw new Error('Endpoint is required for REST provider')
    }

    this.config = {
      ...restConfig,
      timeout: restConfig.timeout ?? 30000,
    }

    // Verify connection by calling health endpoint
    try {
      const response = await this.fetch('/health', { method: 'GET' })
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }
      this.connected = true
    }
    catch (error) {
      this.connected = false
      throw new Error(
        `Failed to connect to sync server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async disconnect(): Promise<void> {
    this.config = null
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected && this.config !== null
  }

  // ============ Pull ============

  async pull(cursor?: string | null): Promise<PullResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        records: [],
        cursor: null,
        hasMore: false,
        error: this.createError('auth_failed', 'Not connected to sync server'),
      }
    }

    try {
      const params = new URLSearchParams()
      if (cursor) {
        params.set('cursor', cursor)
      }
      params.set('limit', '100')

      const response = await this.fetch(`/sync/pull?${params.toString()}`, {
        method: 'GET',
      })

      if (!response.ok) {
        return {
          success: false,
          records: [],
          cursor: null,
          hasMore: false,
          error: await this.parseErrorResponse(response),
        }
      }

      const data = (await response.json()) as {
        records: SyncRecord[]
        cursor: string | null
        hasMore: boolean
      }

      return {
        success: true,
        records: data.records,
        cursor: data.cursor,
        hasMore: data.hasMore,
      }
    }
    catch (error) {
      return {
        success: false,
        records: [],
        cursor: null,
        hasMore: false,
        error: this.createError(
          'network_error',
          error instanceof Error ? error.message : 'Network error during pull',
        ),
      }
    }
  }

  // ============ Push ============

  async push(changes: SyncRecord[]): Promise<PushResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        applied: [],
        failed: [],
        error: this.createError('auth_failed', 'Not connected to sync server'),
      }
    }

    if (changes.length === 0) {
      return {
        success: true,
        applied: [],
        failed: [],
      }
    }

    try {
      const response = await this.fetch('/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: changes }),
      })

      if (!response.ok) {
        return {
          success: false,
          applied: [],
          failed: [],
          error: await this.parseErrorResponse(response),
        }
      }

      const data = (await response.json()) as {
        applied: string[]
        failed: Array<{
          id: string
          reason: 'conflict' | 'validation' | 'not_found' | 'server_error'
          message: string
          serverVersion?: SyncRecord
        }>
      }

      return {
        success: true,
        applied: data.applied,
        failed: data.failed,
      }
    }
    catch (error) {
      return {
        success: false,
        applied: [],
        failed: [],
        error: this.createError(
          'network_error',
          error instanceof Error ? error.message : 'Network error during push',
        ),
      }
    }
  }

  // ============ Helper Methods ============

  private async fetch(path: string, options: RequestInit): Promise<Response> {
    if (!this.config) {
      throw new Error('Not configured')
    }

    const url = `${this.config.endpoint}${path}`
    const headers: Record<string, string> = {}

    // Copy existing headers
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value
        })
      }
      else if (Array.isArray(options.headers)) {
        for (const [key, value] of options.headers) {
          headers[key] = value
        }
      }
      else {
        Object.assign(headers, options.headers)
      }
    }

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      return await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })
    }
    finally {
      clearTimeout(timeoutId)
    }
  }

  private createError(code: SyncError['code'], message: string): SyncError {
    return {
      code,
      message,
      recoverable: code !== 'auth_failed',
    }
  }

  private async parseErrorResponse(response: Response): Promise<SyncError> {
    try {
      const data = (await response.json()) as { error?: string, code?: string }

      if (response.status === 401 || response.status === 403) {
        return this.createError('auth_failed', data.error ?? 'Authentication failed')
      }

      if (response.status === 409) {
        return this.createError('conflict', data.error ?? 'Conflict detected')
      }

      if (response.status === 429) {
        return {
          code: 'quota_exceeded',
          message: data.error ?? 'Rate limit exceeded',
          recoverable: true,
          retryAfter: 60000,
        }
      }

      return this.createError('server_error', data.error ?? `Server error: ${response.status}`)
    }
    catch {
      return this.createError('server_error', `Server error: ${response.status}`)
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRestProvider(): RestSyncProvider {
  return new RestSyncProvider()
}
