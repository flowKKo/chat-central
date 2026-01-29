import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImportExportActions, ImportExportButtons } from './ImportExport'

// Mock logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock export/import modules
const mockExportData = vi.fn()
const mockImportData = vi.fn()
const mockValidateImportFile = vi.fn()

vi.mock('@/utils/sync/export', () => ({
  exportData: (...args: unknown[]) => mockExportData(...args),
}))

vi.mock('@/utils/sync/import', () => ({
  importData: (...args: unknown[]) => mockImportData(...args),
  validateImportFile: (...args: unknown[]) => mockValidateImportFile(...args),
}))

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
const mockRevokeObjectURL = vi.fn()
Object.defineProperty(globalThis.URL, 'createObjectURL', {
  value: mockCreateObjectURL,
  writable: true,
})
Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
  value: mockRevokeObjectURL,
  writable: true,
})

describe('importExportActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExportData.mockResolvedValue({
      blob: new Blob(['test'], { type: 'application/zip' }),
      filename: 'chat-central-export.zip',
    })
    mockValidateImportFile.mockResolvedValue({ valid: true, errors: [] })
    mockImportData.mockResolvedValue({
      success: true,
      imported: { conversations: 5, messages: 20 },
      skipped: { conversations: 0, messages: 0 },
      errors: [],
    })
  })

  it('should render export and import buttons', () => {
    render(<ImportExportActions />)

    expect(screen.getByText('Export Data')).toBeInTheDocument()
    expect(screen.getByText('Import Data')).toBeInTheDocument()
  })

  it('should call exportData when export button clicked', async () => {
    render(<ImportExportActions />)

    const exportButton = screen.getByText('Export Data').closest('button')!
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(mockExportData).toHaveBeenCalledWith({
        type: 'full',
        platforms: ['claude', 'chatgpt', 'gemini'],
      })
    })
  })

  it('should disable export button during export', async () => {
    let resolveExport: ((value: unknown) => void) | undefined
    mockExportData.mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve
      })
    )

    render(<ImportExportActions />)

    const exportButton = screen.getByText('Export Data').closest('button')!
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(exportButton).toBeDisabled()
    })

    // Resolve to clean up
    resolveExport!({
      blob: new Blob(),
      filename: 'export.zip',
    })

    await waitFor(() => {
      expect(exportButton).not.toBeDisabled()
    })
  })

  it('should show export error when export fails', async () => {
    mockExportData.mockRejectedValue(new Error('Network failure'))

    render(<ImportExportActions />)

    const exportButton = screen.getByText('Export Data').closest('button')!
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument()
    })
  })

  it('should open file picker when import button clicked', () => {
    render(<ImportExportActions />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    const importButton = screen.getByText('Import Data').closest('button')!
    fireEvent.click(importButton)

    expect(clickSpy).toHaveBeenCalled()
  })

  it('should show success result after successful import', async () => {
    render(<ImportExportActions />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['zip content'], 'export.zip', { type: 'application/zip' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Import successful')).toBeInTheDocument()
      expect(screen.getByText(/Conversations imported:/)).toBeInTheDocument()
      expect(screen.getByText(/Messages imported:/)).toBeInTheDocument()
    })
  })

  it('should show error result when validation fails', async () => {
    mockValidateImportFile.mockResolvedValue({
      valid: false,
      errors: [{ message: 'Invalid file format' }],
    })

    render(<ImportExportActions />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['bad content'], 'bad.zip', { type: 'application/zip' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Import failed')).toBeInTheDocument()
      expect(screen.getByText('Invalid file format')).toBeInTheDocument()
    })
  })

  it('should show error result when import throws', async () => {
    mockImportData.mockRejectedValue(new Error('Corrupt archive'))

    render(<ImportExportActions />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['corrupt'], 'corrupt.zip', { type: 'application/zip' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Import failed')).toBeInTheDocument()
      expect(screen.getByText('Corrupt archive')).toBeInTheDocument()
    })
  })

  it('should disable import button during import', async () => {
    let resolveImport: ((value: unknown) => void) | undefined
    mockImportData.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve
      })
    )

    render(<ImportExportActions />)

    const importButton = screen.getByText('Import Data').closest('button')!
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'data.zip', { type: 'application/zip' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(importButton).toBeDisabled()
    })

    // Resolve to clean up
    resolveImport!({
      success: true,
      imported: { conversations: 0, messages: 0 },
      skipped: { conversations: 0, messages: 0 },
      errors: [],
    })

    await waitFor(() => {
      expect(importButton).not.toBeDisabled()
    })
  })

  it('should show skipped counts when conversations are skipped', async () => {
    mockImportData.mockResolvedValue({
      success: true,
      imported: { conversations: 3, messages: 10 },
      skipped: { conversations: 2, messages: 5 },
      errors: [],
    })

    render(<ImportExportActions />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'data.zip', { type: 'application/zip' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Import successful')).toBeInTheDocument()
      expect(screen.getByText(/Conversations skipped:/)).toBeInTheDocument()
      expect(screen.getByText(/Messages skipped:/)).toBeInTheDocument()
    })
  })

  it('should accept custom className', () => {
    const { container } = render(<ImportExportActions className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should reset file input after import completes', async () => {
    render(<ImportExportActions />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'data.zip', { type: 'application/zip' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Import successful')).toBeInTheDocument()
    })

    expect(fileInput.value).toBe('')
  })
})

describe('importExportButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExportData.mockResolvedValue({
      blob: new Blob(['test'], { type: 'application/zip' }),
      filename: 'chat-central-export.zip',
    })
  })

  it('should render compact export and import buttons', () => {
    render(<ImportExportButtons />)

    expect(screen.getByTitle('Export data')).toBeInTheDocument()
    expect(screen.getByTitle('Import data')).toBeInTheDocument()
  })

  it('should call exportData when compact export button clicked', async () => {
    render(<ImportExportButtons />)

    const exportButton = screen.getByTitle('Export data')
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(mockExportData).toHaveBeenCalledWith({ type: 'full' })
    })
  })

  it('should have hidden file input accepting zip files', () => {
    render(<ImportExportButtons />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveAttribute('accept', '.zip')
    expect(fileInput).toHaveClass('hidden')
  })
})
