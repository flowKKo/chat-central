import type { Platform } from '@/types'

const EXPORT_ENABLED_PLATFORMS: readonly Platform[] = ['claude']

export function isWidgetExportEnabled(
  platform: Platform,
  isDev: boolean = import.meta.env.DEV
): boolean {
  if (isDev) return true
  return EXPORT_ENABLED_PLATFORMS.includes(platform)
}
