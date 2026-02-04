import '@testing-library/jest-dom'
import { vi } from 'vitest'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from '@/locales/en/common.json'
import enConversations from '@/locales/en/conversations.json'
import enSettings from '@/locales/en/settings.json'
import enCloudSync from '@/locales/en/cloudSync.json'
import enConflicts from '@/locales/en/conflicts.json'
import enAbout from '@/locales/en/about.json'
import enPopup from '@/locales/en/popup.json'

// Initialize i18next for tests with English translations
// so existing test assertions on English strings continue to work.
i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      conversations: enConversations,
      settings: enSettings,
      cloudSync: enCloudSync,
      conflicts: enConflicts,
      about: enAbout,
      popup: enPopup,
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'conversations', 'settings', 'cloudSync', 'conflicts', 'about', 'popup'],
  interpolation: { escapeValue: false },
})

// Mock @/locales to prevent side effects (loadConfig, watchConfig) in tests
vi.mock('@/locales', () => ({
  default: i18n,
  initLanguage: () => () => {},
}))
