import type { Platform } from '@/types'
import type { PlatformAdapter } from './types'
import { claudeAdapter } from './claude'
import { chatgptAdapter } from './chatgpt'
import { geminiAdapter } from './gemini'

export type { PlatformAdapter, CapturedResponse } from './types'

/**
 * All Platform Adapters
 */
export const adapters: Record<Platform, PlatformAdapter> = {
  claude: claudeAdapter,
  chatgpt: chatgptAdapter,
  gemini: geminiAdapter,
}

/**
 * Get the corresponding platform adapter based on URL
 */
export function getAdapterForUrl(url: string): PlatformAdapter | null {
  for (const adapter of Object.values(adapters)) {
    if (adapter.shouldCapture(url)) {
      return adapter
    }
  }
  return null
}

/**
 * Get platform from hostname
 */
export function getPlatformFromHost(hostname: string): Platform | null {
  if (hostname.includes('claude.ai')) return 'claude'
  if (hostname.includes('openai.com') || hostname.includes('chatgpt.com')) return 'chatgpt'
  if (hostname.includes('gemini.google.com')) return 'gemini'
  return null
}

/**
 * Check if the URL belongs to a supported platform
 */
export function isSupportedPlatform(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return getPlatformFromHost(hostname) !== null
  } catch {
    return false
  }
}