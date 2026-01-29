import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ThemePreference } from '@/utils/atoms/theme'
import { clearAllData, clearPlatformData } from '@/utils/db'
import { downloadExport, exportData } from '@/utils/sync/export'
import { importData, importFromJson, validateImportFile } from '@/utils/sync/import'
import { AppearanceSettings } from './AppearanceSettings'
import { DangerZoneSettings } from './DangerZoneSettings'
import { DataTransferSettings } from './DataTransferSettings'
import { PlatformDataSettings } from './PlatformDataSettings'
import { PrivacyNotice } from './PrivacyNotice'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Hoist the theme atom to avoid localStorage access in jsdom
const { mockThemePreferenceAtom } = await vi.hoisted(async () => {
  const { atom } = await import('jotai')
  return { mockThemePreferenceAtom: atom<ThemePreference>('system') }
})

vi.mock('@/utils/atoms/theme', () => ({
  themePreferenceAtom: mockThemePreferenceAtom,
}))

vi.mock('@/utils/db', () => ({
  clearAllData: vi.fn().mockResolvedValue(undefined),
  clearPlatformData: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utils/sync/export', () => ({
  exportData: vi
    .fn()
    .mockResolvedValue({
      blob: new Blob(),
      filename: 'export.zip',
      stats: { conversations: 0, messages: 0, sizeBytes: 0 },
    }),
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

// Typed mock references
const mockClearAllData = vi.mocked(clearAllData)
const mockClearPlatformData = vi.mocked(clearPlatformData)
const mockExportData = vi.mocked(exportData)
const mockDownloadExport = vi.mocked(downloadExport)
const mockImportData = vi.mocked(importData)
const mockImportFromJson = vi.mocked(importFromJson)
const mockValidateImportFile = vi.mocked(validateImportFile)

// Mock window.confirm
const confirmSpy = vi.spyOn(window, 'confirm')

// Mock window.location.reload
const reloadSpy = vi.fn()
Object.defineProperty(window, 'location', {
  value: { ...window.location, reload: reloadSpy },
  writable: true,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithStore(ui: React.ReactElement, store: ReturnType<typeof createStore>) {
  return render(<Provider store={store}>{ui}</Provider>)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('appearanceSettings', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    store.set(mockThemePreferenceAtom, 'system')
  })

  it('should render section title and description', () => {
    renderWithStore(<AppearanceSettings />, store)
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Customize how the app looks')).toBeInTheDocument()
  })

  it('should render all three theme options', () => {
    renderWithStore(<AppearanceSettings />, store)
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('should mark the current theme as selected', () => {
    renderWithStore(<AppearanceSettings />, store)
    const systemRadio = screen.getByRole('radio', { name: /system/i })
    expect(systemRadio).toHaveAttribute('aria-checked', 'true')

    const lightRadio = screen.getByRole('radio', { name: /light/i })
    expect(lightRadio).toHaveAttribute('aria-checked', 'false')
  })

  it('should change theme preference when clicking a theme button', () => {
    renderWithStore(<AppearanceSettings />, store)
    const darkButton = screen.getByRole('radio', { name: /dark/i })
    fireEvent.click(darkButton)

    expect(store.get(mockThemePreferenceAtom)).toBe('dark')
  })

  it('should render a radiogroup with accessible label', () => {
    renderWithStore(<AppearanceSettings />, store)
    const radioGroup = screen.getByRole('radiogroup', { name: /theme selection/i })
    expect(radioGroup).toBeInTheDocument()
  })
})

describe('dangerZoneSettings', () => {
  beforeEach(() => {
    confirmSpy.mockReset()
    mockClearAllData.mockReset().mockResolvedValue(undefined)
    reloadSpy.mockReset()
  })

  it('should render the danger section heading and description', () => {
    render(<DangerZoneSettings />)
    expect(screen.getByText('Delete All Data')).toBeInTheDocument()
    expect(
      screen.getByText('Permanently delete all conversations. This cannot be undone.')
    ).toBeInTheDocument()
  })

  it('should render the delete all button', () => {
    render(<DangerZoneSettings />)
    expect(screen.getByText('Delete All')).toBeInTheDocument()
  })

  it('should show confirmation dialog when clicking delete all', () => {
    confirmSpy.mockReturnValue(false)
    render(<DangerZoneSettings />)

    fireEvent.click(screen.getByText('Delete All'))

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete all synced conversations? This cannot be undone.'
    )
  })

  it('should not call clearAllData when confirmation is cancelled', () => {
    confirmSpy.mockReturnValue(false)
    render(<DangerZoneSettings />)

    fireEvent.click(screen.getByText('Delete All'))

    expect(mockClearAllData).not.toHaveBeenCalled()
  })

  it('should call clearAllData and reload when confirmation is accepted', async () => {
    confirmSpy.mockReturnValue(true)
    render(<DangerZoneSettings />)

    fireEvent.click(screen.getByText('Delete All'))

    await waitFor(() => {
      expect(mockClearAllData).toHaveBeenCalledOnce()
    })
    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledOnce()
    })
  })
})

describe('dataTransferSettings', () => {
  beforeEach(() => {
    mockExportData
      .mockReset()
      .mockResolvedValue({
        blob: new Blob(),
        filename: 'export.zip',
        stats: { conversations: 0, messages: 0, sizeBytes: 0 },
      })
    mockDownloadExport.mockReset()
    mockImportData.mockReset()
    mockImportFromJson.mockReset()
    mockValidateImportFile.mockReset().mockResolvedValue({ valid: true, errors: [] })
  })

  it('should render section title and description', () => {
    render(<DataTransferSettings />)
    expect(screen.getByText('Data Transfer')).toBeInTheDocument()
    expect(screen.getByText('Export or import your conversations')).toBeInTheDocument()
  })

  it('should render export controls', () => {
    render(<DataTransferSettings />)
    expect(screen.getByText('Export Data')).toBeInTheDocument()
    expect(screen.getByText('Download as ZIP archive')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('should render import controls', () => {
    render(<DataTransferSettings />)
    expect(screen.getByText('Import Data')).toBeInTheDocument()
    expect(screen.getByText('Restore from .zip or .json')).toBeInTheDocument()
    expect(screen.getByText('Choose file')).toBeInTheDocument()
  })

  it('should have the import button disabled when no file is selected', () => {
    render(<DataTransferSettings />)
    const importButton = screen.getByText('Import')
    expect(importButton.closest('button')).toBeDisabled()
  })

  it('should call exportData and downloadExport when clicking export', async () => {
    render(<DataTransferSettings />)

    fireEvent.click(screen.getByText('Export'))

    await waitFor(() => {
      expect(mockExportData).toHaveBeenCalledWith({ type: 'full' })
    })
    await waitFor(() => {
      expect(mockDownloadExport).toHaveBeenCalledOnce()
    })
  })

  it('should accept .zip and .json files for import', () => {
    render(<DataTransferSettings />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).not.toBeNull()
    expect(fileInput.accept).toBe('.zip,.json')
  })
})

describe('platformDataSettings', () => {
  beforeEach(() => {
    confirmSpy.mockReset()
    mockClearPlatformData.mockReset().mockResolvedValue(undefined)
    reloadSpy.mockReset()
  })

  it('should render section title and description', () => {
    render(<PlatformDataSettings />)
    expect(screen.getByText('Platform Data')).toBeInTheDocument()
    expect(screen.getByText('Manage synced data by platform')).toBeInTheDocument()
  })

  it('should render all three platforms with clear buttons', () => {
    render(<PlatformDataSettings />)
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('ChatGPT')).toBeInTheDocument()
    expect(screen.getByText('Gemini')).toBeInTheDocument()

    const clearButtons = screen.getAllByText('Clear')
    expect(clearButtons).toHaveLength(3)
  })

  it('should show platform-specific confirmation when clicking clear', () => {
    confirmSpy.mockReturnValue(false)
    render(<PlatformDataSettings />)

    const clearButtons = screen.getAllByText('Clear')
    fireEvent.click(clearButtons[0]!)

    expect(confirmSpy).toHaveBeenCalledWith('Delete all Claude conversations?')
  })

  it('should not call clearPlatformData when confirmation is cancelled', () => {
    confirmSpy.mockReturnValue(false)
    render(<PlatformDataSettings />)

    const clearButtons = screen.getAllByText('Clear')
    fireEvent.click(clearButtons[0]!)

    expect(mockClearPlatformData).not.toHaveBeenCalled()
  })

  it('should call clearPlatformData and reload when confirmation is accepted', async () => {
    confirmSpy.mockReturnValue(true)
    render(<PlatformDataSettings />)

    const clearButtons = screen.getAllByText('Clear')
    fireEvent.click(clearButtons[0]!)

    await waitFor(() => {
      expect(mockClearPlatformData).toHaveBeenCalledWith('claude')
    })
    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledOnce()
    })
  })
})

describe('privacyNotice', () => {
  it('should render the privacy heading', () => {
    render(<PrivacyNotice />)
    expect(screen.getByText('Your Data is Private')).toBeInTheDocument()
  })

  it('should render the privacy description', () => {
    render(<PrivacyNotice />)
    expect(
      screen.getByText(
        'All data is stored locally in your browser. Nothing is sent to external servers.'
      )
    ).toBeInTheDocument()
  })
})
