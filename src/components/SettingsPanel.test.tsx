import { render, screen, fireEvent } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsPanel } from './SettingsPanel'
import type { ThemePreference } from '@/utils/atoms/theme'

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({}),
    },
    commands: {
      getAll: vi.fn().mockResolvedValue([]),
    },
  },
}))

// Mock DB functions
vi.mock('@/utils/db', () => ({
  clearPlatformData: vi.fn().mockResolvedValue(undefined),
}))

// Mock export/import functions
vi.mock('@/utils/sync/export', () => ({
  exportData: vi.fn().mockResolvedValue({ blob: new Blob(), filename: 'export.zip' }),
}))

vi.mock('@/utils/sync/import', () => ({
  importData: vi.fn(),
  importFromJson: vi.fn(),
  validateImportFile: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
}))

vi.mock('@/utils/sync/utils', () => ({
  isFileSizeSafe: vi.fn().mockReturnValue({ safe: true, sizeFormatted: '1 MB' }),
  downloadBlob: vi.fn(),
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
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
      expect(screen.getByText('Data Transfer')).toBeInTheDocument()
      expect(screen.getByText('Platform Data')).toBeInTheDocument()
      expect(screen.queryByText('Cloud Sync')).not.toBeInTheDocument()
    })

    it('should render version info', () => {
      renderWithStore(store)
      expect(screen.getByText(/Chat Central v/)).toBeInTheDocument()
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

    it('should show confirmation before clearing platform data', () => {
      confirmSpy.mockReturnValue(false)
      renderWithStore(store)

      const clearButtons = screen.getAllByText('Clear')
      fireEvent.click(clearButtons[0]!) // Claude

      expect(confirmSpy).toHaveBeenCalledWith('Delete all Claude conversations?')
    })
  })
})
