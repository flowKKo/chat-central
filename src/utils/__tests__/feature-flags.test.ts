import { describe, expect, it } from 'vitest'
import { isWidgetExportEnabled } from '../feature-flags'

describe('isWidgetExportEnabled', () => {
  describe('production mode (isDev=false)', () => {
    it('returns true for claude', () => {
      expect(isWidgetExportEnabled('claude', false)).toBe(true)
    })

    it('returns false for chatgpt', () => {
      expect(isWidgetExportEnabled('chatgpt', false)).toBe(false)
    })

    it('returns false for gemini', () => {
      expect(isWidgetExportEnabled('gemini', false)).toBe(false)
    })
  })

  describe('development mode (isDev=true)', () => {
    it('returns true for claude', () => {
      expect(isWidgetExportEnabled('claude', true)).toBe(true)
    })

    it('returns true for chatgpt', () => {
      expect(isWidgetExportEnabled('chatgpt', true)).toBe(true)
    })

    it('returns true for gemini', () => {
      expect(isWidgetExportEnabled('gemini', true)).toBe(true)
    })
  })
})
