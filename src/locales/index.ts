import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { loadConfig, watchConfig } from '@/utils/atoms/config'

import enCommon from './en/common.json'
import enConversations from './en/conversations.json'
import enSettings from './en/settings.json'
import enCloudSync from './en/cloudSync.json'
import enConflicts from './en/conflicts.json'
import enAbout from './en/about.json'
import enPopup from './en/popup.json'

import zhCNCommon from './zh-CN/common.json'
import zhCNConversations from './zh-CN/conversations.json'
import zhCNSettings from './zh-CN/settings.json'
import zhCNCloudSync from './zh-CN/cloudSync.json'
import zhCNConflicts from './zh-CN/conflicts.json'
import zhCNAbout from './zh-CN/about.json'
import zhCNPopup from './zh-CN/popup.json'

const resources = {
  en: {
    common: enCommon,
    conversations: enConversations,
    settings: enSettings,
    cloudSync: enCloudSync,
    conflicts: enConflicts,
    about: enAbout,
    popup: enPopup,
  },
  'zh-CN': {
    common: zhCNCommon,
    conversations: zhCNConversations,
    settings: zhCNSettings,
    cloudSync: zhCNCloudSync,
    conflicts: zhCNConflicts,
    about: zhCNAbout,
    popup: zhCNPopup,
  },
}

let initialized = false

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'conversations', 'settings', 'cloudSync', 'conflicts', 'about', 'popup'],
  interpolation: {
    escapeValue: false,
  },
})

/**
 * Initialize language from persisted config and watch for changes.
 * Safe to call multiple times — only runs once per lifecycle.
 * Returns a cleanup function to stop watching (resets so it can be re-initialized).
 */
export function initLanguage(): () => void {
  if (initialized) return () => {}
  initialized = true

  // Load initial language from config
  loadConfig().then((config) => {
    const lang = config.ui.language ?? 'en'
    if (lang !== i18n.language) {
      i18n.changeLanguage(lang)
    }
  })

  // Watch for language changes from other contexts (popup, widget, background)
  const unwatch = watchConfig((config) => {
    const lang = config.ui.language ?? 'en'
    if (lang !== i18n.language) {
      i18n.changeLanguage(lang)
    }
  })

  return () => {
    unwatch()
    initialized = false
  }
}

export default i18n
