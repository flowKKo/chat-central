import { render, screen, fireEvent } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsPanel } from './SettingsPanel'
import type { ThemePreference } from '@/utils/atoms/theme'
import {
  autoSyncEnabledAtom,
  autoSyncIntervalAtom,
  cloudSyncErrorAtom,
  cloudSyncStatusAtom,
  isCloudConnectedAtom,
  lastCloudSyncAtom,
  lastSyncResultAtom,
} from '@/utils/atoms/cloud-sync'

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Mock cloud-sync module
vi.mock('@/utils/sync/cloud-sync', () => ({
  connectCloudProvider: vi.fn().mockResolvedValue(undefined),
  disconnectCloudProvider: vi.fn().mockResolvedValue(undefined),
  loadCloudSyncState: vi.fn().mockResolvedValue({
    provider: null,
    isConnected: false,
    lastSyncAt: null,
    autoSyncEnabled: false,
    autoSyncIntervalMinutes: 5,
    error: null,
  }),
  syncToCloud: vi.fn().mockResolvedValue({ success: true, stats: {} }),
}))

// Mock DB functions
vi.mock('@/utils/db', () => ({
  clearAllData: vi.fn().mockResolvedValue(undefined),
  clearPlatformData: vi.fn().mockResolvedValue(undefined),
}))

// Mock export/import functions
vi.mock('@/utils/sync/export', () => ({
  exportData: vi.fn().mockResolvedValue({ blob: new Blob(), filename: 'export.zip' }),
  downloadExport: vi.fn(),
}))

vi.mock('@/utils/sync/import', () => ({
  importData: vi.fn(),
  importFromJson: vi.fn(),
  validateImportFile: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
}))

vi.mock('@/utils/sync/utils', () => ({
  isFileSizeSafe: vi.fn().mockReturnValue({ safe: true, sizeFormatted: '1 MB' }),
}))

// Mock theme atom module to avoid localStorage.getItem issue in jsdom
// Use vi.hoisted + dynamic import to avoid require() lint error
const { mockThemePreferenceAtom } = await vi.hoisted(async () => {
  const { atom } = await import('jotai')
  return { mockThemePreferenceAtom: atom<ThemePreference>('system') }
})
vi.mock('@/utils/atoms/theme', () => ({
  themePreferenceAtom: mockThemePreferenceAtom,
}))

// Mock window.confirm
const confirmSpy = vi.spyOn(window, 'confirm')

function renderWithStore(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <SettingsPanel />
    </Provider>
  )
}

describe('settingsPanel', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    store.set(mockThemePreferenceAtom, 'system')
    // Cloud sync defaults
    store.set(isCloudConnectedAtom, false)
    store.set(cloudSyncStatusAtom, 'idle')
    store.set(lastCloudSyncAtom, null)
    store.set(cloudSyncErrorAtom, null)
    store.set(lastSyncResultAtom, null)
    store.set(autoSyncEnabledAtom, false)
    store.set(autoSyncIntervalAtom, 5)
    confirmSpy.mockReset()
  })

  describe('page structure', () => {
    it('should render settings heading', () => {
      renderWithStore(store)
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('Manage your preferences and data')).toBeInTheDocument()
    })

    it('should render all sections', () => {
      renderWithStore(store)
      expect(screen.getByText('Appearance')).toBeInTheDocument()
      expect(screen.getByText('Data Transfer')).toBeInTheDocument()
      expect(screen.getByText('Cloud Sync')).toBeInTheDocument()
      expect(screen.getByText('Platform Data')).toBeInTheDocument()
      expect(screen.getByText('Your Data is Private')).toBeInTheDocument()
      expect(screen.getByText('Delete All Data')).toBeInTheDocument()
    })

    it('should render version info', () => {
      renderWithStore(store)
      expect(screen.getByText('Chat Central v0.1.0')).toBeInTheDocument()
    })
  })

  describe('appearance section', () => {
    it('should render all theme options', () => {
      renderWithStore(store)
      expect(screen.getByText('Light')).toBeInTheDocument()
      expect(screen.getByText('Dark')).toBeInTheDocument()
      expect(screen.getByText('System')).toBeInTheDocument()
    })

    it('should have System selected by default', () => {
      renderWithStore(store)
      const systemButton = screen.getByRole('radio', { name: /system/i })
      expect(systemButton).toHaveAttribute('aria-checked', 'true')
    })

    it('should change theme on click', () => {
      renderWithStore(store)
      const darkButton = screen.getByRole('radio', { name: /dark/i })
      fireEvent.click(darkButton)

      expect(store.get(mockThemePreferenceAtom)).toBe('dark')
    })
  })

  describe('data transfer section', () => {
    it('should render export and import controls', () => {
      renderWithStore(store)
      expect(screen.getByText('Export Data')).toBeInTheDocument()
      expect(screen.getByText('Import Data')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
      expect(screen.getByText('Choose file')).toBeInTheDocument()
    })

    it('should have import button disabled when no file selected', () => {
      renderWithStore(store)
      const importButton = screen.getByText('Import')
      expect(importButton.closest('button')).toBeDisabled()
    })
  })

  describe('platform data section', () => {
    it('should render all platforms with clear buttons', () => {
      renderWithStore(store)
      expect(screen.getByText('Claude')).toBeInTheDocument()
      expect(screen.getByText('ChatGPT')).toBeInTheDocument()
      expect(screen.getByText('Gemini')).toBeInTheDocument()

      const clearButtons = screen.getAllByText('Clear')
      expect(clearButtons).toHaveLength(3)
    })
  })

  describe('danger zone', () => {
    it('should render delete all button', () => {
      renderWithStore(store)
      expect(screen.getByText('Delete All')).toBeInTheDocument()
      expect(screen.getByText(/Permanently delete all conversations/)).toBeInTheDocument()
    })

    it('should show confirmation before deleting all data', () => {
      confirmSpy.mockReturnValue(false)
      renderWithStore(store)

      fireEvent.click(screen.getByText('Delete All'))

      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to delete all synced conversations? This cannot be undone.'
      )
    })

    it('should show confirmation before clearing platform data', () => {
      confirmSpy.mockReturnValue(false)
      renderWithStore(store)

      const clearButtons = screen.getAllByText('Clear')
      fireEvent.click(clearButtons[0]!) // Claude

      expect(confirmSpy).toHaveBeenCalledWith('Delete all Claude conversations?')
    })
  })
})
