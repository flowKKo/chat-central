import { describe, expect, it } from 'vitest'

import enCommon from './en/common.json'
import enConversations from './en/conversations.json'
import enSettings from './en/settings.json'
import enConflicts from './en/conflicts.json'
import enAbout from './en/about.json'
import enPopup from './en/popup.json'

import zhCNCommon from './zh-CN/common.json'
import zhCNConversations from './zh-CN/conversations.json'
import zhCNSettings from './zh-CN/settings.json'
import zhCNConflicts from './zh-CN/conflicts.json'
import zhCNAbout from './zh-CN/about.json'
import zhCNPopup from './zh-CN/popup.json'

const namespaces = [
  { name: 'common', en: enCommon, zhCN: zhCNCommon },
  { name: 'conversations', en: enConversations, zhCN: zhCNConversations },
  { name: 'settings', en: enSettings, zhCN: zhCNSettings },
  { name: 'conflicts', en: enConflicts, zhCN: zhCNConflicts },
  { name: 'about', en: enAbout, zhCN: zhCNAbout },
  { name: 'popup', en: enPopup, zhCN: zhCNPopup },
]

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getKeys(obj[key] as Record<string, unknown>, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys.sort()
}

describe('translation completeness', () => {
  for (const ns of namespaces) {
    describe(`namespace: ${ns.name}`, () => {
      it('zh-CN should have all keys that en has', () => {
        const enKeys = getKeys(ns.en as Record<string, unknown>)
        const zhKeys = getKeys(ns.zhCN as Record<string, unknown>)
        const missing = enKeys.filter((k) => !zhKeys.includes(k))
        expect(missing, `zh-CN is missing keys: ${missing.join(', ')}`).toEqual([])
      })

      it('en should have all keys that zh-CN has (no extra keys in zh-CN)', () => {
        const enKeys = getKeys(ns.en as Record<string, unknown>)
        const zhKeys = getKeys(ns.zhCN as Record<string, unknown>)
        const extra = zhKeys.filter((k) => !enKeys.includes(k))
        expect(extra, `zh-CN has extra keys: ${extra.join(', ')}`).toEqual([])
      })
    })
  }
})
